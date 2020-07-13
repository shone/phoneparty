package server

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net"
	"net/http"
	"sync"
)

var hosts sync.Map

type Host struct {
	Websocket   *websocket.Conn
	SendChannel chan []byte
}

func HandleHostWebsocket(response http.ResponseWriter, request *http.Request) {
	ip, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		msg := fmt.Sprintf("Rejected host connection as its remote address ('%s') could not be parsed into host/port parts: %s", request.RemoteAddr, err)
		log.Println(msg)
		http.Error(response, msg, http.StatusBadRequest)
		return
	}

	_, foundExistingHost := hosts.Load(ip)
	if foundExistingHost {
		msg := fmt.Sprintf("Rejected host connection '%s' because there's already a host connected on that address", request.RemoteAddr)
		log.Println(msg)
		http.Error(response, msg, http.StatusConflict)
		return
	}

	websocket_, err := websocketUpgrader.Upgrade(response, request, nil)
	if err != nil {
		msg := fmt.Sprintf("Unable to upgrade host HTTP connection ('%s') to websocket: %s", request.RemoteAddr, err)
		log.Println(msg)
		http.Error(response, msg, http.StatusInternalServerError)
		return
	}
	log.Println("Host connected - Address:", request.RemoteAddr)

	host := Host{websocket_, make(chan []byte)}

	hosts.Store(ip, host)

	defer func() {
		hosts.Delete(ip)
		close(host.SendChannel)
		// Notify players that the host has disconnected
		players.Range(func(playerId, player interface{}) bool {
			if player.(Player).IP == ip {
				player.(Player).Websocket.WriteMessage(websocket.TextMessage, []byte(`{"host": "disconnected"}`))
			}
			return true
		})
	}()

	// Notify players that a host has connected
	players.Range(func(playerId, player interface{}) bool {
		if player.(Player).IP == ip {
			player.(Player).Websocket.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
		}
		return true
	})

	// Relay messages from players to host
	go func() {
		for message := range host.SendChannel {
			err = websocket_.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				log.Println("Could not write to websocket while relaying from player to host:", err)
				return
			}
		}
	}()

	// Relay messages from host to players
	for {
		_, message, err := websocket_.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Println("Host websocket closed unexpectedly")
			} else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
				log.Println("Host websocket closed")
			} else {
				log.Println("Error reading from host websocket: ", err)
			}
			return
		}

		messageJson := make(map[string]interface{})
		err = json.Unmarshal(message, &messageJson)
		if err != nil {
			log.Println("Error while decoding JSON from host:", err)
			return
		}

		playerIdInterface, ok := messageJson["playerId"]
		if !ok {
			log.Println("playerId not present in JSON from host:", message)
			return
		}
		playerIdFloat64, ok := playerIdInterface.(float64)
		if !ok {
			log.Println("playerId in message from host is not of number type:", message)
			return
		}
		playerId := uint64(playerIdFloat64)

		player, found := players.Load(playerId)
		if !found {
			log.Println("Received message from host for player", playerId, "but a websocket for the player could not be found")
			continue
		}

		delete(messageJson, "playerId")

		messageToPlayer, err := json.Marshal(messageJson)
		if err != nil {
			log.Println("Could not encode JSON to send to player:", err)
			return
		}
		err = player.(Player).Websocket.WriteMessage(websocket.TextMessage, messageToPlayer)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Println("Player", playerId, "websocket closed unexpectedly")
			} else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
				log.Println("Player", playerId, "websocket closed")
			} else {
				log.Println("Error while attempting to write to player websocket: ", err)
			}
			players.Delete(playerId)
			host, found := hosts.Load(ip)
			if found {
				host.(Host).SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
			}
		}
	}
}
