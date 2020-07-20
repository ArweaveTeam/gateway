
resource "aws_route53_record" "ams_1_eu_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "ams-1.eu-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["178.62.222.154"]
}

resource "aws_route53_record" "ams_2_eu_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "ams-2.eu-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["178.62.209.140"]
}


resource "aws_route53_record" "blr_1_ap_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "blr-1.ap-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["139.59.19.218"]
}

resource "aws_route53_record" "blr_2_ap_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "blr-2.ap-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["159.65.156.112"]
}


resource "aws_route53_record" "fra_1_eu_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-1.eu-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["157.230.102.219"]
}

resource "aws_route53_record" "fra_2_eu_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-2.eu-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["104.248.251.82"]
}

resource "aws_route53_record" "fra_3_eu_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-3.eu-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["104.248.23.136"]
}


resource "aws_route53_record" "lon_1_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-1.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["209.97.129.57"]
}

resource "aws_route53_record" "lon_2_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-2.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["209.97.191.10"]
}

resource "aws_route53_record" "lon_3_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-3.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["134.209.27.239"]
}

resource "aws_route53_record" "lon_4_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-4.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.128.173"]
}

resource "aws_route53_record" "lon_5_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-5.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["134.209.27.233"]
}

resource "aws_route53_record" "lon_6_eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-6.eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.134.138"]
}


resource "aws_route53_record" "nyc_1_na_east_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-1.na-east-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["159.89.227.203"]
}

resource "aws_route53_record" "nyc_2_na_east_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-2.na-east-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["159.89.236.26"]
}


resource "aws_route53_record" "sfo_1_na_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "sfo-1.na-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["206.189.70.139"]
}

resource "aws_route53_record" "sfo_2_na_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "sfo-2.na-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.99.106.38"]
}


resource "aws_route53_record" "sgp_1_ap_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-1.ap-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["178.128.89.236"]
}

resource "aws_route53_record" "sgp_2_ap_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-2.ap-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["178.128.85.23"]
}


resource "aws_route53_record" "tor_1_na_east_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "tor-1.na-east-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.227.34.27"]
}

resource "aws_route53_record" "tor_2_na_east_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "tor-2.na-east-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.227.36.199"]
}



resource "aws_route53_record" "eu_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "eu-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["188.166.200.45"]
}


resource "aws_route53_record" "eu_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "eu-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["188.166.192.169"]
}


resource "aws_route53_record" "eu_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "eu-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["46.101.67.172"]
}



resource "aws_route53_record" "na_east_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "na-east-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["159.203.158.108"]
}


resource "aws_route53_record" "na_east_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "na-east-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["159.203.49.13"]
}


resource "aws_route53_record" "na_west_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "na-west-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["138.197.232.192"]
}



resource "aws_route53_record" "ap_central_1_arweave_net" {
  zone_id = var.dns_zone
  name    = "ap-central-1.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["139.59.51.59"]
}


resource "aws_route53_record" "ap_central_2_arweave_net" {
  zone_id = var.dns_zone
  name    = "ap-central-2.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["163.47.11.64"]
}

resource "aws_route53_record" "fra_1_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-1.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["134.209.232.163"]
}


resource "aws_route53_record" "fra_2_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-2.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.22.75.231"]
}


resource "aws_route53_record" "fra_3_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-3.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.55.76"]
}


resource "aws_route53_record" "fra_5_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "fra-5.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["206.81.23.98"]
}


resource "aws_route53_record" "lon_1_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-1.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["134.209.180.114"]
}


resource "aws_route53_record" "lon_2_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "lon-2.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["134.209.191.173"]
}


resource "aws_route53_record" "nyc_1_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-1.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["157.230.2.154"]
}


resource "aws_route53_record" "nyc_2_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-2.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["157.230.85.148"]
}


resource "aws_route53_record" "nyc_3_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-3.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.22.179.150"]
}


resource "aws_route53_record" "nyc_4_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-4.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.22.179.149"]
}


resource "aws_route53_record" "nyc_5_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "nyc-5.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["165.227.90.106"]
}


resource "aws_route53_record" "sgp_1_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-1.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["157.230.45.221"]
}


resource "aws_route53_record" "sgp_2_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-2.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["157.230.45.215"]
}


resource "aws_route53_record" "sgp_3_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-3.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.220.18"]
}


resource "aws_route53_record" "sgp_4_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-4.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.212.179"]
}


resource "aws_route53_record" "sgp_5_dev_arweave_net" {
  zone_id = var.dns_zone
  name    = "sgp-5.dev.arweave.net."
  type    = "A"
  ttl     = "60"
  records = ["167.71.223.188"]
}

resource "aws_route53_record" "legacy_aws_ac_validation_1" {
  zone_id = var.dns_zone
  name    = "_059f79a089e28defe6a81a12b958cb6c.arweave.net."
  type    = "CNAME"
  ttl     = "60"
  records = ["_d055f21927478f3bd5cf5f7560853535.olprtlswtu.acm-validations.aws."]
}

resource "aws_route53_record" "legacy_aws_ac_validation_2" {
  zone_id = var.dns_zone
  name    = "_6f7eb73be2c448e67527c576cb6f2cde.2.arweave.net."
  type    = "CNAME"
  ttl     = "60"
  records = ["_b952afd0bbb10d3636c4e8d378d89cb8.nhqijqilxf.acm-validations.aws."]
}

