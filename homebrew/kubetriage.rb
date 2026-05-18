class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.0"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.0/kubetriage-1.8.0-darwin-arm64.tar.gz"
      sha256 "ad1e6955409a1bb7cd54bd22b1248bd1b39a278083e1c3bfa887302e258f99c4"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.0/kubetriage-1.8.0-darwin-amd64.tar.gz"
      sha256 "33f9615cc1a18dac30d92ad1b9a88676342f3a4343ae4c3aa4cc1b05e13e5a46"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.0/kubetriage-1.8.0-linux-amd64.tar.gz"
      sha256 "2f294ad7db1a5bf5c050f88ea88a901d9a054125f63178a50ec69f7afbbd0daf"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.0/kubetriage-1.8.0-linux-arm64.tar.gz"
      sha256 "0e977165151dc2e9c74df591e8acdb49a063bb1d3168cdb5bb03e894e51bc7ca"
    end
  end

  def install
    binary_name = "kubetriage-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch}"
    binary_name = binary_name.gsub("x86_64", "amd64")
    bin.install binary_name => "kubetriage"
  end

  def post_install
    puts "KubeTriage installed!"
    puts "Run 'kubetriage serve' to start the server."
    puts "Run 'kubetriage --help' for all available commands."
  end

  test do
    system bin/"kubetriage", "--help"
  end
end
