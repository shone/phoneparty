package main
import (
  "net/http"
  "log"
  "github.com/gorilla/websocket"
  "sync"
  "sync/atomic"
  "encoding/json"
)

type ClientMessage struct {
  ClientId uint64 `json:"clientId"`
  Type     string `json:"type"`
  Message  string `json:"message"`
}

func main() {
  // Serve files
  http.Handle("/", http.FileServer(http.Dir(".")))

  var hostConn *websocket.Conn
  var clientConns sync.Map
  var nextClientId uint64

  var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
  }
  // Allow all origins
  upgrader.CheckOrigin = func(r *http.Request) bool { return true }

  hostSendChan := make(chan []byte)

  http.HandleFunc("/host", func(response http.ResponseWriter, request *http.Request) {
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

    clientConns.Range(func (clientId, clientConn interface{}) bool {
      (clientConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, []byte("Host connected"))
      return true
    })

    hostDisconnectedChan := make(chan bool)
    
    // Relay messages from clients to host
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

    // Relay messages from host to clients
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
        clientConns.Range(func (clientId, clientConn interface{}) bool {
          (clientConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, []byte("Host disconnected"))
          return true
        })
        hostConn = nil
        return
      }

      clientMessage := ClientMessage{}
      json.Unmarshal(message, &clientMessage)
      clientConn,found := clientConns.Load(clientMessage.ClientId)
      if !found {
        log.Println("Received message from host for client ", clientMessage.ClientId, " but the client could not be found")
        continue
      }
      err = (clientConn.(*websocket.Conn)).WriteMessage(websocket.TextMessage, []byte(clientMessage.Message))
      if err != nil {
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Client", clientMessage.ClientId, "websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Client", clientMessage.ClientId, "websocket closed")
        } else  {
          log.Println("Error while attempting to write to client websocket: ", err)
        }
        clientConns.Delete(clientMessage.ClientId)
        messageToHost,_ := json.Marshal(ClientMessage{ClientId: clientMessage.ClientId, Type: "clientDisconnected"})
        hostSendChan <- messageToHost
      }
    }
  })
  http.HandleFunc("/client", func(response http.ResponseWriter, request *http.Request) {
    conn,err := upgrader.Upgrade(response, request, nil)
    if err != nil {
      log.Println("Unable to upgrade client connection to websocket: ", err)
      return
    }
    clientId := atomic.AddUint64(&nextClientId, 1)
    log.Println("Client", clientId, "connected")
    clientConns.Store(clientId, conn)

    if hostConn != nil {
      conn.WriteMessage(websocket.TextMessage, []byte("Host connected"))
    }
    
    for {
      _,message,err := conn.ReadMessage()
      if err != nil {
        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
          log.Println("Client", clientId, "websocket closed unexpectedly")
        } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
          log.Println("Client", clientId, "websocket closed")
        } else  {
          log.Println("Error while reading from client websocket: ", err)
        }
        clientConns.Delete(clientId)
        messageToHost,_ := json.Marshal(ClientMessage{ClientId: clientId, Type: "clientDisconnected"})
        hostSendChan <- messageToHost
        return
      }

      messageWithClientId,_ := json.Marshal(ClientMessage{ClientId: clientId, Message: string(message)})
      hostSendChan <- messageWithClientId
    }
  })

  if err := http.ListenAndServe(":8080", nil); err != nil {
    panic(err)
  }
}
