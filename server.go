package main
import (
  "net/http"
  "log"
  "github.com/gorilla/websocket"
  "sync"
  "sync/atomic"
)

func main() {
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
    // Relay all messages to client
    for {
      messageType,message,err := conn.ReadMessage()
      if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
        log.Println("Host websocket closed unexpectedly")
        hostConn = nil
        return
      } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
        log.Println("Host websocket closed")
        hostConn = nil
        return
      }
      if err != nil {
        log.Println("Error reading from host websocket: ", err)
      } else if messageType != websocket.TextMessage {
        log.Println("Unexpected message type received from host websocket")
      } else {
        log.Println("Received message from host, relaying to client..")
        err = clientWebsocket.WriteMessage(websocket.TextMessage, message)
        if err != nil {
          log.Println("Error while attempting to write to client websocket: ", err)
        }
      }
    }
  })
  http.HandleFunc("/client", func(response http.ResponseWriter, request *http.Request) {
    if clientWebsocket != nil {
      log.Println("A client attempted to connect, but there's already a client connected")
      return
    }
    conn,err := upgrader.Upgrade(response, request, nil)
    if err != nil {
      log.Println("Unable to upgrade client connection to websocket: ", err)
      return
    }
    log.Println("Client connected")
    clientId := atomic.AddUint64(&nextClientId, 1)
    clientConns.Store(clientId, conn)

    messageType,clientSdp,err := conn.ReadMessage()
    if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
      log.Println("Client websocket closed unexpectedly")
      clientWebsocket = nil
      return
    } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
      log.Println("Client websocket closed")
      clientWebsocket = nil
      return
    }
    if err != nil {
      log.Println("Error while attempting to read SDP from client: ", err)
    }
    if messageType != websocket.TextMessage {
      log.Println("Unexpected message type received from client websocket")
    }
    log.Println("Client SDP received, relaying to host..")
    err = hostConn.WriteMessage(websocket.TextMessage, clientSdp)
    if err != nil {
      log.Println("Unable to relay client SDP to host: ", err)
    }
    for {
      messageType,message,err := conn.ReadMessage()
      if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
        log.Println("Client websocket closed unexpectedly")
        clientWebsocket = nil
        return
      } else if websocket.IsCloseError(err, websocket.CloseGoingAway) {
        log.Println("Client websocket closed")
        clientWebsocket = nil
        return
      }
      if err != nil {
        log.Println("Error while reading from client websocket: ", err)
        continue
      }
      if messageType != websocket.TextMessage {
        log.Println("Received unexpected message type from host websocket")
      }
      log.Println("Received message from client, relaying to host..")
      err = hostConn.WriteMessage(websocket.TextMessage, message)
      if err != nil {
        log.Println("Unable to write to host websocket: ", err)
      }
    }
  });

  if err := http.ListenAndServe(":8080", nil); err != nil {
    panic(err)
  }
}
