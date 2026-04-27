class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.7.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.1/kubetriage-v1.7.1-dirty-darwin-arm64.tar.gz"
      sha256 "db36a1507a46657e8efc9265728f25ddab100a34b7b8fc5756df2c068feb0f67"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.1/kubetriage-v1.7.1-dirty-darwin-amd64.tar.gz"
      sha256 "f3f88470b754a651493c904658a666c801bdeb579e0bba8b341030a998747546"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.1/kubetriage-v1.7.1-dirty-linux-amd64.tar.gz"
      sha256 "1e6d550b03e9cf917f44804b3e68f4d3f17e4060d24d534e104c87e5e026e0f5"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.1/kubetriage-v1.7.1-dirty-linux-arm64.tar.gz"
      sha256 "cb3c9f51f5bb6f95bb92778a2a5435a0879715d879a36c38d0295e970ca69668"
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
