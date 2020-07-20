variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "environment" {
  type = string
}

variable "name" {
  type = string
}

variable "certificate_arn" {
  type = string
}


variable "az_count" {
  description = "Number of AZs to cover in a given AWS region"
}

variable "app_image" {
  description = "Docker image to run in the ECS cluster"
}

variable "app_port" {
  description = "Port exposed by the docker image to redirect traffic to"
}

variable "app_count" {
  description = "Number of docker containers to run"
}

variable "fargate_cpu" {
  description = "Fargate instance CPU units to provision (1 vCPU = 1024 CPU units)"
  type        = number
}

variable "fargate_memory" {
  description = "Fargate instance memory to provision (in MiB)"
  type        = number
}

variable "ecs_task_log_group" {
  description = "ECS log group"
}

variable "container_definitions" {
  description = "Container definitions"
}


resource "aws_ecs_cluster" "ecs_cluster" {
  name = "${var.name}-${var.environment}-ecs-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "logs" {
  name              = "/ecs/${var.name}-${var.environment}"
  retention_in_days = 30
}

### Security

# ALB Security group
# This is the group you need to edit if you want to restrict access to your application
resource "aws_security_group" "ecs_alb" {
  name        = "${var.name}-${var.environment}-alb-sg"
  description = "Controls access to the ALB"
  vpc_id      = var.vpc_id

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Traffic to the ECS Cluster should only come from the ALB
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.name}-${var.environment}-ecs-sg"
  description = "Allow inbound access from the ALB only"
  vpc_id      = var.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = var.app_port
    to_port         = var.app_port
    security_groups = [aws_security_group.ecs_alb.id]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}


### ALB

# data "aws_elb_service_account" "main" {}

# resource "aws_s3_bucket" "ecs_alb_logs" {
#   bucket_prefix = "${var.name}-alb-logs-eu-west-2"
#   tags = {
#     Environment = var.environment
#   }
# }

# resource "aws_s3_bucket_public_access_block" "ecs_alb_logs_block_public" {
#   bucket = aws_s3_bucket.ecs_alb_logs.id

#   block_public_acls   = true
#   block_public_policy = true
# }

# resource "aws_s3_bucket_policy" "ecs_alb_logs_policy" {
#   bucket = aws_s3_bucket.ecs_alb_logs.id
#   policy = <<POLICY
# {
#   "Id": "Policy",
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Action": [
#         "s3:PutObject"
#       ],
#       "Effect": "Allow",
#       "Resource": "arn:aws:s3:::${aws_s3_bucket.ecs_alb_logs.id}-*/*",
#       "Principal": {
#         "AWS": [
#           "${data.aws_elb_service_account.main.arn}"
#         ]
#       }
#     }
#   ]
# }
# POLICY
# }



resource "aws_alb" "ecs_alb" {
  name                       = "${var.name}-${var.environment}-alb"
  subnets                    = var.subnet_ids
  security_groups            = [aws_security_group.ecs_alb.id]
  enable_deletion_protection = true

  # access_logs {
  #   bucket  = aws_s3_bucket.ecs_alb_logs.id
  #   prefix  = var.environment
  #   enabled = true
  # }
}

resource "aws_alb_target_group" "gateway" {
  name                 = "${var.name}-${var.environment}-tg-ecs"
  port                 = 80
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 60
}


# Redirect all traffic from the ALB to the target group
resource "aws_alb_listener" "http" {
  load_balancer_arn = aws_alb.ecs_alb.id
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_alb_listener" "https" {
  load_balancer_arn = aws_alb.ecs_alb.id
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.certificate_arn

  default_action {
    target_group_arn = aws_alb_target_group.gateway.id
    type             = "forward"
  }
}



resource "aws_ecs_task_definition" "gateway" {
  family                   = "${var.name}-${var.environment}-ecs-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = "arn:aws:iam::384386061638:role/ecsTaskExecutionRole"
  task_role_arn            = "arn:aws:iam::384386061638:role/ecsTaskExecutionRole"

  container_definitions = var.container_definitions
}

resource "aws_ecs_service" "service" {
  name            = "${var.name}-${var.environment}-ecs-service"
  cluster         = aws_ecs_cluster.ecs_cluster.id
  task_definition = aws_ecs_task_definition.gateway.arn
  desired_count   = var.app_count
  launch_type     = "FARGATE"

  network_configuration {
    assign_public_ip = true
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = var.subnet_ids
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.gateway.id
    container_name   = "${var.name}-${var.environment}"
    container_port   = var.app_port
  }

  depends_on = [
    aws_alb_listener.http,
    aws_alb_listener.https
  ]
}


output "alb_dns_name" {
  value = aws_alb.ecs_alb.dns_name
}

output "alb_dns_zone" {
  value = aws_alb.ecs_alb.zone_id
}
