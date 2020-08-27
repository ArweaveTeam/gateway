variable "domain" {
  type    = string
  default = "arweave.net"
}

variable "api_domain" {
  type    = string
  default = "api.arweave.net"
}

variable "db_whitelist_sources" {
  type = list(string)
  default = [
    "52.56.34.141/32",
    "0.0.0.0/0"
  ]
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnet_ids" "all" {
  vpc_id = data.aws_vpc.default.id
}

module "acm_region_us_east_1" {
  source = "../modules/acm"
  domain = var.domain
  providers = {
    aws = aws.us-east-1
  }
}

module "acm_region_eu_west_2" {
  source = "../modules/acm"
  domain = var.domain
  providers = {
    aws = aws.eu-west-2
  }
}


module "cdn" {
  source = "../modules/cdn"
  domain = var.domain
  origin = var.api_domain
  failover_origins = [
    "us.${var.api_domain}",
    "eu.${var.api_domain}",
  ]
  certificate_arn = module.acm_region_us_east_1.arn
  environment     = "prod"
  log_bucket_name = "arweave-gateway-prod-cdn-logs-"
  providers = {
    aws = aws.eu-west-2
  }
}

module "postgres_cluster_eu_west_2" {
  source            = "../modules/aurora_cluster"
  vpc_id            = data.aws_vpc.default.id
  subnet_ids        = data.aws_subnet_ids.all.ids
  whitelist_sources = var.db_whitelist_sources
  environment       = "prod"
  from_snapshot     = "arweave-gateway-dev-2020-05-26-14-34"
  # security_group_ids
  name = "arweave-gateway-prod"
  providers = {
    aws = aws.eu-west-2
  }
}


module "elasticache" {
  source                = "../modules/elasticache"
  name                  = "arweave-gateway-prod"
  subnet_ids            = data.aws_subnet_ids.all.ids
  security_group_ids  = ["sg-0f1e7b5995149213f"]# allow everything, elasticache can't be accessed from outside of a VPC at all
  instance_class        = "cache.r4.large"
  environment           = "dev"
  providers = {
    aws = aws.eu-west-2
  }
}

module "ecs" {
  source                = "../modules/ecs"
  name                  = "gateway"
  vpc_id                = data.aws_vpc.default.id
  subnet_ids            = data.aws_subnet_ids.all.ids
  environment           = "prod"
  app_port              = 3000
  app_count             = 3
  az_count              = 3
  fargate_cpu           = 1024
  fargate_memory        = 2048
  certificate_arn       = module.acm_region_eu_west_2.arn
  app_image             = "384386061638.dkr.ecr.eu-west-2.amazonaws.com/arweave-gateway-prod:latest"
  ecs_task_log_group    = "/ecs/gateway-prod"
  container_definitions = file("ecs.json")
  providers = {
    aws = aws.eu-west-2
  }
}


output "acm_arns" {
  value = {
    us-east-1 = module.acm_region_us_east_1.arn,
    eu-west-2 = module.acm_region_eu_west_2.arn,
  }
}
