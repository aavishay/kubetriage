class Kubetriage < Formula
  desc "Autonomous SRE Guard for Kubernetes"
  homepage "https://github.com/aavishay/kubetriage"
  version "1.7.3"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.3/kubetriage-v1.7.3-darwin-arm64.tar.gz"
      sha256 "4c2866bae4c1cc0c3700c2bd166dbe4277e6085376d266c529c22bf6e5fc90b0"
    end
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.3/kubetriage-v1.7.3-darwin-amd64.tar.gz"
      sha256 "a79ef727402f680215a1de66e0de0d012937f5e9e83deedf30a64e12e5f192d4"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.3/kubetriage-v1.7.3-linux-amd64.tar.gz"
      sha256 "0dc448efb0b7ee13ce16760d7ce493e398997e478f1092865341d59806f4f159"
    end
    on_arm do
      url "https://github.com/aavishay/kubetriage/releases/download/v1.7.3/kubetriage-v1.7.3-linux-arm64.tar.gz"
      sha256 "fa7486a5ac1271fed606651aac2877702663653163f646de7828a4031c2dae22"
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
