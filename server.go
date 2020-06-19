package main

import (
  "net"
  "net/http"
  "github.com/gorilla/websocket"
  "log"
  "fmt"
  "strings"
  "flag"
  "os"
  "path/filepath"
  "sync"
  "sync/atomic"
  "encoding/json"
  "crypto/tls"
  "golang.org/x/crypto/acme/autocert"
)

var hosts   sync.Map
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

func main() {
  serve_address := flag.String("serve_address", ":8080", "The host/port to serve on, e.g. localhost:8080")
  domain := flag.String("domain", "", "e.g. 'example.com' When specified, will serve HTTPS for the domain using automatically retrieved Let's Encrypt certificates.")
  flag.Parse()

  http.Handle("/",        FileServer("./player", ""))
  http.Handle("/host/",   FileServer("./host",   "/host/"))
  http.Handle("/shared/", FileServer("./shared", "/shared/"))
  http.Handle("/sounds/", FileServer("./sounds", "/sounds/"))
  http.Handle("/fonts/",  FileServer("./fonts",  "/fonts/"))
  http.Handle("/games/",  FileServer("./games",  "/games/"))

  http.HandleFunc("/host/ws",   handleHostWebsocket)
  http.HandleFunc("/player/ws", handlePlayerWebsocket)

  if *domain != "" {

    certManager := autocert.Manager{
      Prompt:     autocert.AcceptTOS,
      HostPolicy: autocert.HostWhitelist(*domain),
      Cache:      autocert.DirCache("certs"),
    }

    log.Println("Serving HTTP on", *domain, "for ACME and HTTPS redirect")
    go func() {
      err := http.ListenAndServe(":http", certManager.HTTPHandler(nil))
      log.Fatal(err)
    }()

    server := &http.Server{
      Addr: ":https",
      TLSConfig: &tls.Config{
        GetCertificate: certManager.GetCertificate,
      },
    }

    log.Println("Serving HTTPS on", *domain)
    err := server.ListenAndServeTLS("", "")
    log.Fatal(err)
  } else {
    log.Println("Starting HTTP server on", *serve_address)
    err := http.ListenAndServe(*serve_address, nil)
    log.Fatal(err)
  }
}

func FileServer(directory, prefix string) http.Handler {
  handler := http.StripPrefix(prefix, http.FileServer(http.Dir(directory)))

  return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {

    writer.Header().Set("Cache-Control", "must-revalidate")

    if request.URL.Path == "/" || request.URL.Path == "/host/" {
      // Rather than needing a build step to bundle JS/CSS into a single file, rely on
      // HTTP2 server push to transfer all required files immediately.
      if pusher, ok := writer.(http.Pusher); ok {
        switch request.URL.Path {
          case "/":      pushFilesForPlayer(pusher)
          case "/host/": pushFilesForHost(pusher)
        }
      }
    }

    handler.ServeHTTP(writer, request)
  })
}

func pushFilesForPlayer(pusher http.Pusher) {
  pushFiles(pusher, "player", "/", "")
  pushFiles(pusher, "shared", "/shared/", "")
  pushFiles(pusher, "games", "/games/", "player")
}
func pushFilesForHost(pusher http.Pusher) {
  pushFiles(pusher, "host", "/host/", "")
  pushFiles(pusher, "shared", "/shared/", "")
  pushFiles(pusher, "games", "/games/", "host")
}

func pushFiles(pusher http.Pusher, directory, prefix, matchSubdir string) {
  err := filepath.Walk(directory, func(path string, info os.FileInfo, err error) error {
    if err != nil {
      log.Println(err)
      return err
    }

    if info.IsDir() {
      if matchSubdir != "" {
        parts := strings.Split(path, "/")
        if len(parts) >= 3 {
          for _,part := range parts {
            if part == matchSubdir {
              return nil
            }
          }
          return filepath.SkipDir
        }
      } else {
        return nil
      }
    }

    ext := filepath.Ext(info.Name())

    if ext == ".mjs" || ext == ".css" {
      url := prefix + path[len(directory)+1:]
      err := pusher.Push(url, nil)
      if err != nil {
        return err
      }
    }

    return nil
  })
  if err != nil {
    log.Println(err)
  }
}

var websocketUpgrader = websocket.Upgrader{
  ReadBufferSize:  1024,
  WriteBufferSize: 1024,
  CheckOrigin: func(r *http.Request) bool { return true }, // Allow all origins
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

  defer func() {
    hosts.Delete(ip)
    close(host.SendChannel)
    // Notify players that the host has disconnected
    players.Range(func (playerId, player interface{}) bool {
      if player.(Player).IP == ip {
        player.(Player).Websocket.WriteMessage(websocket.TextMessage, []byte(`{"host": "disconnected"}`))
      }
      return true
    })
  }()

  // Notify players that a host has connected
  players.Range(func (playerId, player interface{}) bool {
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
