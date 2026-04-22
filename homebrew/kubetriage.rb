class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.5.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-arm64.tar.gz"
      sha256 "312b3989f37ff1d290b04ff8c7b22e34fd26b4f3ee79deaf04b96e78832ec044"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-darwin-amd64.tar.gz"
      sha256 "0b497210f742b155d52efb0390511cf1005c6c85ebff1801100977e63d359cfa"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-amd64.tar.gz"
      sha256 "a688f644a7cc989f3aac979cb37803b25079fec33f7002d4aeb874da43397540"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-v#{version}-linux-arm64.tar.gz"
      sha256 "b1a6d2867398597645612b9584d0848d10049d1b32d47ad4d059e38c251b0afd"
    end
  end

  def install
    bin.install "kubetriage-#{OS.kernel_name.downcase}-#{Hardware::CPU.arch.to_s.gsub(/x86_64/, "amd64")}" => "kubetriage"
  end

  def post_install
    puts "KubeTriage installed!"
    puts "Run 'kubetriage serve' to start the server."
    puts "Run 'kubetriage --help' for all available commands."
  end

  test do
    system "#{bin}/kubetriage", "--help"
  end
end
