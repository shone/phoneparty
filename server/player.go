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

var players = struct {
	m map[uint64]*Player
	sync.RWMutex
}{m: make(map[uint64]*Player)}

var nextPlayerID uint64

type Player struct {
	ID        uint64
	IP        string
	Websocket *websocket.Conn
}

type PlayerSignal struct {
	// The ID of the player this message was received from
	PlayerID *uint64 `json:"playerId"`

	// 'type' can be 'sessionDescription' or 'iceCandidate'
	Type string `json:"type"`

	// A WebRTC Session Description used in the process of making a connection with a host.
	SessionDescription *map[string]interface{} `json:"sessionDescription,omitempty"`

	// A WebRTC Interactive Connectivity Establishment candidate used in the process of
	// making a connection with a host.
	ICECandidate *map[string]interface{} `json:"iceCandidate,omitempty"`

	// This will be 'disconnected' when the player websocket disconnects
	ConnectionState *string `json:"connectionState,omitempty"`
}

// Upgrades the HTTP connection to a websocket and relays signals between the player and any host to
// allow them to negotiate WebRTC connections.
func HandlePlayerWebsocket(multihost bool) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {

		ip, _, err := net.SplitHostPort(request.RemoteAddr)
		if err != nil {
			msg := fmt.Sprintf("Rejected player connection as its remote address ('%s') could not be parsed into host/port parts: %s", request.RemoteAddr, err)
			log.Println(msg)
			http.Error(response, msg, http.StatusBadRequest)
			return
		}

		websocket_, err := websocketUpgrader.Upgrade(response, request, nil)
		if err != nil {
			msg := fmt.Sprintf("Unable to upgrade player HTTP connection at '%s' to websocket: %s", request.RemoteAddr, err)
			log.Println(msg)
			http.Error(response, msg, http.StatusInternalServerError)
			return
		}
		playerID := atomic.AddUint64(&nextPlayerID, 1)
		log.Printf("Player connected - ID: %d Address: %s", playerID, ip)

		hosts.RLock()
		found := false
		if multihost {
			_, found = hosts.m[ip]
		} else {
			found = len(hosts.m) == 1
		}
		hosts.RUnlock()
		if found {
			err = websocket_.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
			if err != nil {
				log.Printf("Could not write to player %d websocket at '%s' to notify of connected host: %s", playerID, ip, err)
				return
			}
		}

		player := Player{playerID, ip, websocket_}

		players.Lock()
		players.m[playerID] = &player
		players.Unlock()

		defer func() {
			players.Lock()
			delete(players.m, playerID)
			players.Unlock()

			hosts.RLock()
			var host *Host = nil
			if multihost {
				host, _ = hosts.m[ip]
			} else {
				for _, h := range hosts.m {
					host = h
					break
				}
			}
			if host != nil {
				host.SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "type": "disconnected"}`, playerID))
			}
			hosts.RUnlock()
		}()

		// Relay signals from player to host
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

			playerSignal := PlayerSignal{}
			err = json.Unmarshal(message, &playerSignal)
			if err != nil {
				log.Printf("Error while decoding JSON from player %d at '%s': %s", playerID, ip, err)
				return
			}

			playerSignal.PlayerID = &playerID

			signalWithPlayerID, err := json.Marshal(playerSignal)
			if err != nil {
				log.Printf("Error while encoding JSON for player %d: %s", playerID, err)
				return
			}

			hosts.RLock()
			var host *Host = nil
			if multihost {
				host, _ = hosts.m[ip]
			} else {
				for _, h := range hosts.m {
					host = h
					break
				}
			}
			if host != nil {
				host.SendChannel <- signalWithPlayerID
			}
			hosts.RUnlock()
		}
	})
}
