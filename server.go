package main
import (
  "net/http"
//   "strings"
  "log"
//   "io/ioutil"
  "github.com/gorilla/websocket"
//   "io"
)

func main() {
  http.Handle("/", http.FileServer(http.Dir(".")))

  var hostWebsocket *websocket.Conn
  var clientWebsocket *websocket.Conn
  var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
  }
  upgrader.CheckOrigin = func(r *http.Request) bool { return true }
  http.HandleFunc("/host", func(w http.ResponseWriter, r *http.Request) {
    conn,err := upgrader.Upgrade(w, r, nil)
    if err != nil {
      log.Println(err)
      return
    }
    log.Println("Host connected")
    hostWebsocket = conn
    for {
      _,message,_ := conn.ReadMessage()
      log.Println("Received message from host, relaying..")
      clientWebsocket.WriteMessage(websocket.TextMessage, message)
    }
  })
  http.HandleFunc("/client", func(w http.ResponseWriter, r *http.Request) {
    conn,err := upgrader.Upgrade(w, r, nil)
    if err != nil {
      log.Println(err)
      return
    }
    log.Println("Client connected")
    clientWebsocket = conn
    _,clientSdp,_ := conn.ReadMessage()
    log.Println(string(clientSdp))
    hostWebsocket.WriteMessage(websocket.TextMessage, clientSdp)
    for {
      
      _,message,_ := hostWebsocket.ReadMessage()
      log.Println("Received message from host, relaying..")
      conn.WriteMessage(websocket.TextMessage, message)
    }
  });
  if err := http.ListenAndServe(":8080", nil); err != nil {
    panic(err)
  }
}
