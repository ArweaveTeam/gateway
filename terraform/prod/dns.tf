variable "dns_zone" {
  type    = string
  default = "Z09165953RYEECN6Z9WRV"
}

resource "aws_route53_record" "api" {
  zone_id = var.dns_zone
  name    = "arweave.net."
  type    = "A"
  ttl     = 60
  records = [
    "138.68.116.133"
  ]
  set_identifier = "Digital Ocean"
  weighted_routing_policy {
    weight = 0
  }
}

resource "aws_route53_record" "api_test" {
  zone_id = var.dns_zone
  name    = "arweave.net."
  type    = "A"
  weighted_routing_policy {
    weight = 100
  }
  set_identifier = "ECS"
  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_dns_zone
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_wildcard" {
  zone_id = var.dns_zone
  name    = "*.arweave.net."
  type    = "A"
  ttl     = 60
  records = [
    "138.68.116.133"
  ]
  set_identifier = "Digital Ocean"
  weighted_routing_policy {
    weight = 0
  }
}

resource "aws_route53_record" "api_wildcard_test" {
  zone_id = var.dns_zone
  name    = "*.arweave.net."
  type    = "A"
  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_dns_zone
    evaluate_target_health = false
  }
  set_identifier = "ECS"
  weighted_routing_policy {
    weight = 100
  }
}
