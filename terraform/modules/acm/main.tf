variable "domain" {
  type = string
}

data "aws_route53_zone" "root_zone" {
  name         = var.domain
  private_zone = false
}

module "acm" {
  source  = "terraform-aws-modules/acm/aws"
  version = "~> v2.0"

  domain_name = var.domain
  zone_id     = data.aws_route53_zone.root_zone.zone_id

  subject_alternative_names = [
    "*.${var.domain}"
  ]

  create_certificate   = true
  validate_certificate = true
  wait_for_validation  = true

  tags = {
    Name = var.domain
  }
}

output "arn" {
  value = module.acm.this_acm_certificate_arn
}
