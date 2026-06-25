class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.1"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.1/kubetriage-v1.8.1-darwin-arm64.tar.gz"
      sha256 "ba83dbdc70fad0b0f09cf91cf8467f70503f366a67273db9a1e2a8f409e76b02"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.1/kubetriage-v1.8.1-darwin-amd64.tar.gz"
      sha256 "1e91a70e27a811ee576fdc5d9a910086a443d03b8d71613d11562d3e2af3521d"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.1/kubetriage-v1.8.1-linux-amd64.tar.gz"
      sha256 "dee40386407cf8220aab145c975daf2a55d8e123b4d93be975cdba835daaa7a8"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.1/kubetriage-v1.8.1-linux-arm64.tar.gz"
      sha256 "ca8e8e0d3d8e56740a559006b3b970cfb7f5c851412b02ce587e8579fbccf580"
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
