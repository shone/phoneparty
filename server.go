package main
import (
  "net/http"
  "log"
  "fmt"
  "github.com/gorilla/websocket"
  "sync"
  "sync/atomic"
  "encoding/json"
)

func NoCache(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
    writer.Header().Set("Cache-Control", "must-revalidate")
    handler.ServeHTTP(writer, request)
  })
}

func main() {
  http.Handle("/",                                     NoCache(http.FileServer(http.Dir("./player"))))
  http.Handle("/host/",   http.StripPrefix("/host/",   NoCache(http.FileServer(http.Dir("./host")))))
  http.Handle("/sounds/", http.StripPrefix("/sounds/", NoCache(http.FileServer(http.Dir("./sounds")))))
  http.Handle("/fonts/",  http.StripPrefix("/fonts/",  NoCache(http.FileServer(http.Dir("./fonts")))))
  http.Handle("/games/",  http.StripPrefix("/games/",  NoCache(http.FileServer(http.Dir("./games")))))
  http.Handle("/shared/", http.StripPrefix("/shared/", NoCache(http.FileServer(http.Dir("./shared")))))

  var hostConn *websocket.Conn
  var playerConns sync.Map
  var nextPlayerId uint64

  var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
  }
  // Allow all origins
  upgrader.CheckOrigin = func(r *http.Request) bool { return true }

  hostSendChan := make(chan []byte)

  http.HandleFunc("/host/ws", func(response http.ResponseWriter, request *http.Request) {
    if hostConn != nil {
      log.Println("A host attempted to connect, but there's already a host connected")
      response.WriteHeader(http.StatusConflict)
      response.Write([]byte("A host is already connected"))
      return
    }
    conn,err := upgrader.Upgrade(response, request, nil)
    if err != nil {
      log.Println("Unable to upgrade host connection to websocket: ", err)
      return
    }
    log.Println("Host connected")

    hostConn = conn

    playerConns.Range(func (playerId, playerConn interface{}) bool {
      (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
      return true
    })

    hostDisconnectedChan := make(chan bool)

    defer func() {
      hostConn = nil
      playerConns.Range(func (playerId, playerConn interface{}) bool {
        (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, []byte(`{"host": "disconnected"}`))
        return true
      })
      hostDisconnectedChan <- true
    }()

    // Relay messages from players to host
    go func() {
      for {
        select {
          case message := <- hostSendChan:
            err = conn.WriteMessage(websocket.TextMessage, message)
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
      _,message,err := conn.ReadMessage()
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

      playerConn,found := playerConns.Load(playerId)
      if !found {
        log.Println("Received message from host for player ", playerId, " but the player could not be found")
        continue
      }

      delete(messageJson, "playerId")

      messageToPlayer,err := json.Marshal(messageJson)
      if err != nil {
        log.Println("Could not encode JSON to send to player:", err)
        return
      }
      err = (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, messageToPlayer)
      if err != nil {
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerId, "websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerId, "websocket closed")
        } else  {
          log.Println("Error while attempting to write to player websocket: ", err)
        }
        playerConns.Delete(playerId)
        hostSendChan <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
      }
    }
  })

  http.HandleFunc("/player/ws", func(response http.ResponseWriter, request *http.Request) {
    conn,err := upgrader.Upgrade(response, request, nil)
    if err != nil {
      log.Println("Unable to upgrade player connection to websocket: ", err)
      return
    }
    playerId := atomic.AddUint64(&nextPlayerId, 1)
    log.Println("Player", playerId, "connected")

    playerConns.Store(playerId, conn)
    defer func() {
      playerConns.Delete(playerId)
      hostSendChan <- []byte(fmt.Sprintf(`{"playerId": %d, "connectionState": "disconnected"}`, playerId))
    }()

    if hostConn != nil {
      conn.WriteMessage(websocket.TextMessage, []byte(`{"host": "connected"}`))
    }

    for {
      _,message,err := conn.ReadMessage()
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

      hostSendChan <- messageWithPlayerId
    }
  })

  log.Println("Serving on port 8080..")
  if err := http.ListenAndServe(":8080", nil); err != nil {
    panic(err)
  }
}
