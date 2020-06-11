package main

import (
  "net"
  "net/http"
  "github.com/gorilla/websocket"
  "log"
  "fmt"
  "flag"
  "sync"
  "sync/atomic"
  "encoding/json"
)

var hosts sync.Map

var players sync.Map
var nextPlayerId uint64

type Host struct {
  Websocket *websocket.Conn
  SendChannel chan []byte
}

type Player struct {
  ID uint64
  IP string
  Websocket *websocket.Conn
}

var websocketUpgrader = websocket.Upgrader{
  ReadBufferSize:  1024,
  WriteBufferSize: 1024,
  CheckOrigin: func(r *http.Request) bool { return true }, // Allow all origins
}

func main() {
  var serve_address = flag.String("serve_address", ":8080", "The host/port to serve on, e.g. localhost:8080")
  flag.Parse()

  http.Handle("/",                                     NoCache(http.FileServer(http.Dir("./player"))))
  http.Handle("/host/",   http.StripPrefix("/host/",   NoCache(http.FileServer(http.Dir("./host")))))
  http.Handle("/sounds/", http.StripPrefix("/sounds/", NoCache(http.FileServer(http.Dir("./sounds")))))
  http.Handle("/fonts/",  http.StripPrefix("/fonts/",  NoCache(http.FileServer(http.Dir("./fonts")))))
  http.Handle("/games/",  http.StripPrefix("/games/",  NoCache(http.FileServer(http.Dir("./games")))))
  http.Handle("/shared/", http.StripPrefix("/shared/", NoCache(http.FileServer(http.Dir("./shared")))))

  http.HandleFunc("/host/ws", handleHostWebsocket)
  http.HandleFunc("/player/ws", handlePlayerWebsocket)

  log.Println("Starting HTTP server on", *serve_address)
  err := http.ListenAndServe(*serve_address, nil)
  if err != nil {
    panic(err)
  }
}

func NoCache(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
    writer.Header().Set("Cache-Control", "must-revalidate")
    handler.ServeHTTP(writer, request)
  })
}

func handleHostWebsocket(response http.ResponseWriter, request *http.Request) {
  ip,_,err := net.SplitHostPort(request.RemoteAddr)
  if err != nil {
    log.Println("A host attempted to connect, but its remote address could not be parsed into host/port parts:", request.RemoteAddr)
    response.WriteHeader(http.StatusBadRequest)
    response.Write([]byte("Could not parse remote address into host/port parts"))
    return
  }

  _,foundExistingHost := hosts.Load(ip)
  if foundExistingHost {
    log.Println("A host at", request.RemoteAddr, "attempted to connect, but there's already a host connected on that IP")
    response.WriteHeader(http.StatusConflict)
    response.Write([]byte("A host is already connected on this IP"))
    return
  }

  websocket_,err := websocketUpgrader.Upgrade(response, request, nil)
  if err != nil {
    log.Println("Unable to upgrade host HTTP connection to websocket: ", err)
    return
  }
  log.Println("Host connected - Address:", request.RemoteAddr)

  host := Host{websocket_, make(chan []byte)}

  hosts.Store(ip, host)

  // Notify players that a host has connected
  players.Range(func (playerId, player interface{}) bool {
    if player.(Player).IP == ip {
      player.(Player).Websocket.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
    }
    return true
  })

  hostDisconnectedChan := make(chan bool)

  defer func() {
    hosts.Delete(ip)
    hostDisconnectedChan <- true
    // Notify players that the host has disconnected
    players.Range(func (playerId, player interface{}) bool {
      if player.(Player).IP == ip {
        player.(Player).Websocket.WriteMessage(websocket.TextMessage, []byte(`{"host": "disconnected"}`))
      }
      return true
    })
  }()

  // Relay messages from players to host
  go func() {
    for {
      select {
        case message := <- host.SendChannel:
          err = websocket_.WriteMessage(websocket.TextMessage, message)
          if err != nil {
            return
          }
        case <-hostDisconnectedChan:
          return
      }
    }
  }()

  // Relay messages from host to players
  for {
    _,message,err := websocket_.ReadMessage()
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

    playerIdInterface,ok := messageJson["playerId"]
    if !ok {
      log.Println("playerId not present in JSON from host:", message)
      return
    }
    playerIdFloat64,ok := playerIdInterface.(float64)
    if !ok {
      log.Println("playerId in message from host is not of number type:", message)
      return
    }
    playerId := uint64(playerIdFloat64)

    player,found := players.Load(playerId)
    if !found {
      log.Println("Received message from host for player", playerId, "but a websocket for the player could not be found")
      continue
    }

    delete(messageJson, "playerId")

    messageToPlayer,err := json.Marshal(messageJson)
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
      } else  {
        log.Println("Error while attempting to write to player websocket: ", err)
      }
      players.Delete(playerId)
      host,found := hosts.Load(ip)
      if found {
        host.(Host).SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
      }
    }
  }
}

func handlePlayerWebsocket(response http.ResponseWriter, request *http.Request) {
  ip,_,err := net.SplitHostPort(request.RemoteAddr)
  if err != nil {
    log.Println("A player attempted to connect, but its remote address could not be parsed into host/port parts:", request.RemoteAddr)
    response.WriteHeader(http.StatusConflict)
    response.Write([]byte("Could not parse remote address into host/port parts"))
    return
  }

  websocket_,err := websocketUpgrader.Upgrade(response, request, nil)
  if err != nil {
    log.Println("Unable to upgrade player HTTP connection to websocket: ", err)
    return
  }
  playerId := atomic.AddUint64(&nextPlayerId, 1)
  log.Println("Player connected - ID:", playerId, "Address:", request.RemoteAddr)

  _,found := hosts.Load(ip)
  if found {
    websocket_.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
  }

  player := Player{playerId, ip, websocket_}

  players.Store(playerId, player)
  defer func() {
    players.Delete(playerId)
    host,found := hosts.Load(ip)
    if found {
      host.(Host).SendChannel <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
    }
  }()

  for {
    _,message,err := websocket_.ReadMessage()
    if err != nil {
      if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
        log.Println("Player", playerId, "websocket closed unexpectedly:", err)
      } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
        log.Println("Player", playerId, "websocket closed:", err)
      } else  {
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

    messageWithPlayerId,err := json.Marshal(messageJson)
    if err != nil {
      log.Println("Error while encoding JSON for player", playerId, ":", err)
      return
    }

    host,found := hosts.Load(ip)
    if found {
      host.(Host).SendChannel <- messageWithPlayerId
    }
  }
}
