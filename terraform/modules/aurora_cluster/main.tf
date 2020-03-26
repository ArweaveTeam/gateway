variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "whitelist_sources" {
  type = list(string)
}

# variable "security_group_ids" {
#   type = list(string)
# }

variable "environment" {
  type = string
}

variable "name" {
  type = string
}

# variable "instance_class" {
#   type = string
# }

module "aurora_cluster" {
  source                          = "terraform-aws-modules/rds-aurora/aws"
  version                         = "~> 2.0"
  name                            = var.name
  engine                          = "aurora-postgresql"
  engine_version                  = "11.6"
  subnets                         = var.subnet_ids
  vpc_id                          = var.vpc_id
  replica_count                   = 2
  instance_type                   = "db.r5.large"
  apply_immediately               = true
  skip_final_snapshot             = true
  db_parameter_group_name         = aws_db_parameter_group.aurora_db_postgres11_parameter_group.id
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.aurora_cluster_postgres11_parameter_group.id
  #   enabled_cloudwatch_logs_exports = ["audit", "error", "general", "slowquery"]
  performance_insights_enabled = true
  monitoring_interval          = 30
  #   vpc_security_group_ids          = var.security_group_ids
  allowed_cidr_blocks          = var.whitelist_sources
  database_name                = "arweave"
  engine_mode                  = "provisioned"
  preferred_backup_window      = "02:00-03:00"
  preferred_maintenance_window = "tue:10:00-tue:11:00"
  publicly_accessible          = true
  #deletion_protection            = true
  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}


resource "aws_db_parameter_group" "aurora_db_postgres11_parameter_group" {
  name        = "${var.name}-aurora-postgres11-parameter-group"
  family      = "aurora-postgresql11"
  description = "${var.name}-aurora-postgres11-parameter-group"
}

resource "aws_rds_cluster_parameter_group" "aurora_cluster_postgres11_parameter_group" {
  name        = "${var.name}-aurora-cluster-parameter-group"
  family      = "aurora-postgresql11"
  description = "${var.name}-aurora-cluster-parameter-group"
}

# output "cluster_arn" {
#   value = aws_rds_cluster.cluster.arn
# }
