class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.4"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.4/kubetriage-v1.8.4-darwin-arm64.tar.gz"
      sha256 "552c302911a6d07232a065bcfb6e9f83ea5425c33751a776ec4b8576cc8aec65"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.4/kubetriage-v1.8.4-darwin-amd64.tar.gz"
      sha256 "ba8b314bcaded522d5769ff6fa4601c7aab22ebb381b42c4295be5a0bb696329"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.4/kubetriage-v1.8.4-linux-amd64.tar.gz"
      sha256 "0792142163a2cd880f8f5d0b5fdf5647b5f0c2b100b6fc822c41acd6d0f88182"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.4/kubetriage-v1.8.4-linux-arm64.tar.gz"
      sha256 "4b7d9d7848f19d0526403c854fd752986d21a8f48db852f599b344f24d818199"
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
