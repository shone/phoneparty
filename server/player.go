package server

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
)

var players sync.Map

var nextPlayerId uint64

type Player struct {
	ID        uint64
	IP        string
	Websocket *websocket.Conn
}

func HandlePlayerWebsocket(response http.ResponseWriter, request *http.Request) {
	ip, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		log.Println("A player attempted to connect, but its remote address could not be parsed into host/port parts:", request.RemoteAddr)
		response.WriteHeader(http.StatusConflict)
		response.Write([]byte("Could not parse remote address into host/port parts"))
		return
	}

	websocket_, err := websocketUpgrader.Upgrade(response, request, nil)
	if err != nil {
		log.Println("Unable to upgrade player HTTP connection to websocket: ", err)
		return
	}
	playerId := atomic.AddUint64(&nextPlayerId, 1)
	log.Println("Player connected - ID:", playerId, "Address:", request.RemoteAddr)

	_, found := hosts.Load(ip)
	if found {
		websocket_.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
	}

	player := Player{playerId, ip, websocket_}

	players.Store(playerId, player)
	defer func() {
		players.Delete(playerId)
		host, found := hosts.Load(ip)
		if found {
			host.(Host).SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
		}
	}()

	for {
		_, message, err := websocket_.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Println("Player", playerId, "websocket closed unexpectedly:", err)
			} else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
				log.Println("Player", playerId, "websocket closed:", err)
			} else {
				log.Println("Error while reading from player", playerId, "websocket:", err)
			}
			return
		}

		messageJson := make(map[string]interface{})
		err = json.Unmarshal(message, &messageJson)
		if err != nil {
			log.Println("Error while decoding JSON from player", playerId, ":", err)
			return
		}

		messageJson["playerId"] = playerId

		messageWithPlayerId, err := json.Marshal(messageJson)
		if err != nil {
			log.Println("Error while encoding JSON for player", playerId, ":", err)
			return
		}

		host, found := hosts.Load(ip)
		if found {
			host.(Host).SendChannel <- messageWithPlayerId
		}
	}
}
