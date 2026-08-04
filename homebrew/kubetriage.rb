class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.7"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.7/kubetriage-v1.8.7-darwin-arm64.tar.gz"
      sha256 "76d2465c272c9fc0b6837058e3b0a7280d27c53c22b2ff0ec1a1395037b18d0e"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.7/kubetriage-v1.8.7-darwin-amd64.tar.gz"
      sha256 "73fbb377cd1783ab1c8c422cba71279e50fc0c9bd8223228a684f9311a7e83e2"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.7/kubetriage-v1.8.7-linux-amd64.tar.gz"
      sha256 "9071853e2b7120e6f5a3ec771a21299726d2cd3a743cc8bd37aaea41e27feb2c"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.7/kubetriage-v1.8.7-linux-arm64.tar.gz"
      sha256 "839496f5e5436506ace620b9931e3784e620751db4b5b28d6aea20f1448c9b74"
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
