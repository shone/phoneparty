package server

import (
	"github.com/gorilla/websocket"
	"net/http"
)

var websocketUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true }, // Allow all origins
}

func AllowRootServiceWorker(nextHandler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer nextHandler.ServeHTTP(w, r)
		w.Header().Set("Service-Worker-Allowed", "/")
	})
}
