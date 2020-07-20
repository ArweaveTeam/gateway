variable "domain" {
  type    = string
  default = "arweave.dev"
}

variable "api_domain" {
  type    = string
  default = "api.arweave.dev"
}

variable "db_whitelist_sources" {
  type = list(string)
  default = [
    "52.56.34.141/32"
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

module "acm_region_us_east_2" {
  source = "../modules/acm"
  domain = var.domain
  providers = {
    aws = aws.us-east-2
  }
}

module "acm_region_eu_west_2" {
  source = "../modules/acm"
  domain = var.domain
  providers = {
    aws = aws.eu-west-2
  }
}

module "acm_region_ap_southeast_1" {
  source = "../modules/acm"
  domain = var.domain
  providers = {
    aws = aws.ap-southeast-1
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
  environment     = "dev"
  log_bucket_name = "arweave-gateway-dev-cdn-logs-"
  providers = {
    aws = aws.eu-west-2
  }
}

module "postgres_cluster_eu_west_2" {
  source            = "../modules/aurora_cluster"
  vpc_id            = data.aws_vpc.default.id
  subnet_ids        = data.aws_subnet_ids.all.ids
  whitelist_sources = var.db_whitelist_sources
  environment       = "dev"
  instance_class    = "db.t3.medium"
  # security_group_ids
  name = "arweave-gateway-dev"
  providers = {
    aws = aws.eu-west-2
  }
}


module "ecs" {
  source                = "../modules/ecs"
  name                  = "gateway"
  vpc_id                = data.aws_vpc.default.id
  subnet_ids            = data.aws_subnet_ids.all.ids
  environment           = "dev"
  app_port              = 3000
  app_count             = 2
  az_count              = 2
  fargate_cpu           = 512
  fargate_memory        = 1024
  certificate_arn       = module.acm_region_eu_west_2.arn
  app_image             = "384386061638.dkr.ecr.eu-west-2.amazonaws.com/arweave-gateway-dev:latest"
  ecs_task_log_group    = "/ecs/gateway-dev"
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
