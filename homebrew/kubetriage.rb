class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.2"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.2/kubetriage-v1.8.2-darwin-arm64.tar.gz"
      sha256 "e0096fca7915b9e65f93a4436f6ab3b5834d5e62319299d941347c721c9fd7c0"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.2/kubetriage-v1.8.2-darwin-amd64.tar.gz"
      sha256 "4439bf70c2479375ed2bd265a31927b37a987b3d626590c35e49c713860d3f89"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.2/kubetriage-v1.8.2-linux-amd64.tar.gz"
      sha256 "c2000334940550bf2584076cbff0d371a79ab1b9d5f65f0df5bd7e41077bacfe"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.2/kubetriage-v1.8.2-linux-arm64.tar.gz"
      sha256 "57fa3a2239fa7900e036dac13cb0ee400fabe9232c97a601c6d2b7f667bc1e16"
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
