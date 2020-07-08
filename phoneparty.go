package main

import (
	"crypto/tls"
	"flag"
	"github.com/joshua-shone/phone-party/server"
	"golang.org/x/crypto/acme/autocert"
	"log"
	"net/http"
)

var (
	serve_address = flag.String("serve_address", ":8080", "The host/port to serve on, e.g. localhost:8080")
	domain        = flag.String("domain", "", "e.g. 'example.com' When specified, will serve HTTPS for the domain using automatically retrieved Let's Encrypt certificates.")
)

func main() {
	flag.Parse()

	http.Handle("/", server.FileServer(http.Dir("./player"), ""))
	http.Handle("/host/", server.FileServer(http.Dir("./host"), "/host/"))
	http.Handle("/shared/", server.FileServer(http.Dir("./shared"), "/shared/"))
	http.Handle("/sounds/", server.FileServer(http.Dir("./sounds"), "/sounds/"))
	http.Handle("/fonts/", server.FileServer(http.Dir("./fonts"), "/fonts/"))
	http.Handle("/games/", server.FileServer(http.Dir("./games"), "/games/"))

	http.HandleFunc("/host/ws", server.HandleHostWebsocket)
	http.HandleFunc("/player/ws", server.HandlePlayerWebsocket)

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
