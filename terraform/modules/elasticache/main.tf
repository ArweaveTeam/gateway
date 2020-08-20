variable "environment" {
  type = string
}

variable "name" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "instance_class" {
  type = string
}

variable "security_group_ids" {
  type = list(string)
}

resource "aws_elasticache_cluster" "redis_cluster" {
  subnet_group_name    = "${var.name}-cache-subnet"
  security_group_ids   = var.security_group_ids
  cluster_id           = var.name
  engine               = "redis"
  node_type            = var.instance_class
  num_cache_nodes      = 1
  parameter_group_name = "default.redis5.0"
  port                 = 6379
  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

resource "aws_elasticache_subnet_group" "elasticache_subnet_group" {
  name       = "${var.name}-cache-subnet"
  subnet_ids = var.subnet_ids
}
