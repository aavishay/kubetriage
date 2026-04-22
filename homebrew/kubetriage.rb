class Kubetriage < Formula
  desc "KubeTriage - Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  license "MIT"
  version "1.3.0"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-darwin-arm64.tar.gz"
      sha256 "7cee96a08afcb0f15702d340e27c6039ee4e85ee51ac62413de1b80a3dd3c972"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-darwin-amd64.tar.gz"
      sha256 "729e3331c62155eba3612fecbd9410d52c6401ea9ba4a9e3c97cd9ebc747397a"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-linux-amd64.tar.gz"
      sha256 "04ed290032f326280de789cee1569581801e6c5a7fd407e6cf35eb669eaffedb"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v#{version}/kubetriage-#{version}-linux-arm64.tar.gz"
      sha256 "f1ec2c0d4dee193c4624f815e37a58461b8c2aced3334af937d02d9def4e6a90"
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
