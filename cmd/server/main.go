package main

import (
	"os"

	"github.com/aavishay/kubetriage/backend/cmd/cli"
)

func main() {
	// Delegate to the CLI's serve command
	// This maintains backwards compatibility for existing usage
	os.Args = append([]string{"kubetriage", "serve"}, os.Args[1:]...)
	cli.Execute()
}
