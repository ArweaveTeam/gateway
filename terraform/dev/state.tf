terraform {
  backend "s3" {
    bucket  = "arweave-gateway-terraform-state"
    key     = "dev/state"
    region  = "eu-west-2"
    encrypt = true
  }
}
