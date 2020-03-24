provider "aws" {
  version = "~> 2.43"
  region  = "eu-west-2"
}

provider "aws" {
  alias  = "us-east-2"
  region = "us-east-2"
}

provider "aws" {
  alias  = "eu-west-2"
  region = "eu-west-2"
}

provider "aws" {
  alias  = "ap-southeast-1"
  region = "ap-southeast-1"
}

locals {
  domain = "2.arweave.net"
}

module "acm_region_us_east_2" {
  source = "./modules/acm"
  domain = local.domain
  providers = {
    aws = aws.us-east-2
  }
}

module "acm_region_eu_west_2" {
  source = "./modules/acm"
  domain = local.domain
  providers = {
    aws = aws.eu-west-2
  }
}

module "acm_region_ap_southeast_1" {
  source = "./modules/acm"
  domain = local.domain
  providers = {
    aws = aws.ap-southeast-1
  }
}
