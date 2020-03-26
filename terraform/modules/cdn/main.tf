variable "domain" {
  type = string
}
variable "certificate_arn" {
  type = string
}

variable "origin" {
  type = string
}

variable "failover_origins" {
  type = list(string)
}

variable "log_bucket_name" {
  type = string
}

variable "environment" {
  type = string
}

resource "aws_s3_bucket" "cf_distribution_logs" {
  bucket_prefix = var.log_bucket_name
  tags = {
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "cf_logs_block_public" {
  bucket = aws_s3_bucket.cf_distribution_logs.id

  block_public_acls   = true
  block_public_policy = true
}


resource "aws_cloudfront_distribution" "cf_distribution" {

  enabled = false

  aliases     = [var.domain]
  price_class = "PriceClass_100"

  retain_on_delete = true

  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cf_distribution_logs.bucket_domain_name
  }

  default_cache_behavior {
    allowed_methods  = ["HEAD", "GET", "OPTIONS", "DELETE", "POST", "PUT", "PATCH"]
    cached_methods   = ["HEAD", "GET", "OPTIONS"]
    target_origin_id = var.domain

    min_ttl                = 10
    default_ttl            = 60
    max_ttl                = 86400
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false

      headers = ["Origin"]

      cookies {
        forward = "none"
      }
    }
  }

  origin {
    domain_name = var.domain
    origin_id   = var.domain

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_keepalive_timeout = "30"
    }
  }

  tags = {
    Environment = var.environment
  }

  viewer_certificate {
    ssl_support_method  = "sni-only"
    acm_certificate_arn = var.certificate_arn
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
