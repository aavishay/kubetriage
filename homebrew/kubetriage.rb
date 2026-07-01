class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.8.3"
  license "AGPL-3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.3/kubetriage-v1.8.3-darwin-arm64.tar.gz"
      sha256 "006b9b2e532ccba6ffea48d5feb538c9a3c176219f3ee04419f57a62141c61f8"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.3/kubetriage-v1.8.3-darwin-amd64.tar.gz"
      sha256 "049876690afc3ce3885ce2a0eabcbe997c5f37327fa6a32a8b91b89caea3bbd2"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.3/kubetriage-v1.8.3-linux-amd64.tar.gz"
      sha256 "78efe1e2b606ef3c4e672e3343bdff1c097ef7397d2bedbfc33af2a2e41dc352"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.8.3/kubetriage-v1.8.3-linux-arm64.tar.gz"
      sha256 "f69193656bd478d878221b0c307be1cbe7358c34d0ac91bc210dad1e3738e16d"
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
