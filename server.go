package main
import (
  "net/http"
  "log"
  "github.com/gorilla/websocket"
  "sync"
  "sync/atomic"
  "encoding/json"
)

type Message struct {
  PlayerId uint64 `json:"playerId"`
  Type     string `json:"type"`
  Message  string `json:"message"`
}

type MessageWithPlayerId struct {
  PlayerId uint64 `json:"playerId"`
  Type     string `json:"type"`
  Message  string `json:"message"`
}

func NoCache(handler http.Handler) http.Handler {
  return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
    writer.Header().Set("Cache-Control", "max-age=0")
    handler.ServeHTTP(writer, request)
  })
}

func main() {
  http.Handle("/",                                     NoCache(http.FileServer(http.Dir("./player"))))
  http.Handle("/host/",   http.StripPrefix("/host/",   NoCache(http.FileServer(http.Dir("./host")))))
  http.Handle("/sounds/", http.StripPrefix("/sounds/", NoCache(http.FileServer(http.Dir("./sounds")))))
  http.Handle("/fonts/",  http.StripPrefix("/fonts/",  NoCache(http.FileServer(http.Dir("./fonts")))))
  http.Handle("/games/",  http.StripPrefix("/games/",  NoCache(http.FileServer(http.Dir("./games")))))

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
      messageToPlayer,_ := json.Marshal(Message{Type: "host", Message: "connected"})
      (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, messageToPlayer)
      return true
    })

    hostDisconnectedChan := make(chan bool)
    
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
        hostDisconnectedChan <- true
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Host websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Host websocket closed")
        } else {
          log.Println("Error reading from host websocket: ", err)
        }
        playerConns.Range(func (playerId, playerConn interface{}) bool {
          messageToPlayer,_ := json.Marshal(Message{Type: "host", Message: "disconnected"})
          (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, messageToPlayer)
          return true
        })
        hostConn = nil
        return
      }

      playerMessage := MessageWithPlayerId{}
      json.Unmarshal(message, &playerMessage)
      playerConn,found := playerConns.Load(playerMessage.PlayerId)
      if !found {
        log.Println("Received message from host for player ", playerMessage.PlayerId, " but the player could not be found")
        continue
      }
      messageToPlayer,_ := json.Marshal(Message{Type: playerMessage.Type, Message: playerMessage.Message})
      err = (playerConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, messageToPlayer)
      if err != nil {
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerMessage.PlayerId, "websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerMessage.PlayerId, "websocket closed")
        } else  {
          log.Println("Error while attempting to write to player websocket: ", err)
        }
        playerConns.Delete(playerMessage.PlayerId)
        messageToHost,_ := json.Marshal(MessageWithPlayerId{PlayerId: playerMessage.PlayerId, Type: "playerDisconnected"})
        hostSendChan <- messageToHost
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

    if hostConn != nil {
      messageToPlayer,_ := json.Marshal(Message{Type: "host", Message: "connected"})
      conn.WriteMessage(websocket.TextMessage, messageToPlayer)
    }
    
    for {
      _,message,err := conn.ReadMessage()
      if err != nil {
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerId, "websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Player", playerId, "websocket closed")
        } else  {
          log.Println("Error while reading from player websocket: ", err)
        }
        playerConns.Delete(playerId)
        messageToHost,_ := json.Marshal(MessageWithPlayerId{PlayerId: playerId, Type: "playerDisconnected"})
        hostSendChan <- messageToHost
        return
      }

      messageWithPlayerId,_ := json.Marshal(MessageWithPlayerId{PlayerId: playerId, Message: string(message)})
      hostSendChan <- messageWithPlayerId
    }
  })

  log.Println("Serving on port 8080..")
  if err := http.ListenAndServe(":8080", nil); err != nil {
    panic(err)
  }
}
