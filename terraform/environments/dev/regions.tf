locals {}
# North Virginia (Cloudfront global region)
provider "aws" {
  alias   = "us-east-1"
  region  = "us-east-1"
  version = "~> 2.54"
}

# Ohio
provider "aws" {
  alias   = "us-east-2"
  region  = "us-east-2"
  version = "~> 2.54"

}

# London
provider "aws" {
  alias   = "eu-west-2"
  region  = "eu-west-2"
  version = "~> 2.54"

}

# Singapore
provider "aws" {
  alias   = "ap-southeast-1"
  region  = "ap-southeast-1"
  version = "~> 2.54"

}
