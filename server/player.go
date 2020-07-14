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

var players = make(map[uint64]*Player)
var playersMutex sync.Mutex

var nextPlayerID uint64

type Player struct {
	ID        uint64
	IP        string
	Websocket *websocket.Conn
}

type PlayerMessage struct {
	// The ID of the player this message was received from
	PlayerID *uint64 `json:"playerId"`

	// A Session Description Protocol used in the process of making a WebRTC connection with a host
	SDP *string `json:"sdp"`

	// An Interactive Connectivity Establishment candidate used in the process of
	// making a WebRTC connection with a host
	ICECandidate *string `json:"iceCandidate"`

	// This will be 'disconnected' when the player websocket disconnects
	ConnectionState *string `json:"connectionState"`
}

// Upgrades the HTTP connection to a websocket and relays messages between the player and any host on the
// same IP to allow the player and host to connect over WebRTC.
func HandlePlayerWebsocket(response http.ResponseWriter, request *http.Request) {
	ip, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		msg := fmt.Sprintf("Rejected player connection as its remote address could not be parsed into host/port parts: %s", request.RemoteAddr, err)
		log.Println(msg)
		http.Error(response, msg, http.StatusBadRequest)
		return
	}

	websocket_, err := websocketUpgrader.Upgrade(response, request, nil)
	if err != nil {
		msg := fmt.Sprintf("Unable to upgrade player HTTP connection at '%s' to websocket: %s", ip, err)
		log.Println(msg)
		http.Error(response, msg, http.StatusInternalServerError)
		return
	}
	playerID := atomic.AddUint64(&nextPlayerID, 1)
	log.Printf("Player connected - ID: %d Address: %s", playerID, ip)

	hostsMutex.Lock()
	_, found := hosts[ip]
	hostsMutex.Unlock()
	if found {
		err = websocket_.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
		if err != nil {
			log.Printf("Could not write to player %d websocket at '%s' to notify of connected host: %s", playerID, ip, err)
			return
		}
	}

	player := Player{playerID, ip, websocket_}

	playersMutex.Lock()
	players[playerID] = &player
	playersMutex.Unlock()

	defer func() {
		playersMutex.Lock()
		delete(players, playerID)
		playersMutex.Unlock()

		hostsMutex.Lock()
		host, found := hosts[ip]
		if found {
			host.SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerID))
		}
		hostsMutex.Unlock()
	}()

	// Relay messages from player to host
	for {
		_, message, err := websocket_.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Printf("Player %d websocket at %s closed unexpectedly: %s", playerID, ip, err)
			} else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
				log.Printf("Player %d websocket at %s closed: %s", playerID, ip, err)
			} else {
				log.Printf("Error while reading from player %d websocket at %s: %s", playerID, ip, err)
			}
			return
		}

		playerMessage := PlayerMessage{}
		err = json.Unmarshal(message, &playerMessage)
		if err != nil {
			log.Printf("Error while decoding JSON from player %d at '%s': %s", playerID, ip, err)
			return
		}

		playerMessage.PlayerID = &playerID

		messageWithPlayerID, err := json.Marshal(playerMessage)
		if err != nil {
			log.Printf("Error while encoding JSON for player %d: %s", playerID, err)
			return
		}

		hostsMutex.Lock()
		host, found := hosts[ip]
		if found {
			host.SendChannel <- messageWithPlayerID
		}
		hostsMutex.Unlock()
	}
}
