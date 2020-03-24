## AWS Authentication

**Arweave team account**: 82613677919

**Service sub-account**: 384386061638

1. Setup IAM user and MFA

2. Configure `~/.aws/config`

```
[default]
region = eu-west-2

[profile arweave]
duration_seconds = 3600
mfa_serial=arn:aws:iam::826136779190:mfa/XXX


[profile arweave-gateway-dev]
region=eu-west-2
parent_profile = arweave
source_profile = arweave
role_arn = arn:aws:iam::384386061638:role/arweave-developer
output=json
```

3. Install aws-vault\
   `brew install aws-vault`

4. Add main arweave profile, this will prompt for access keys\
   `aws-vault add arweave`

5. Start a bash session using the `arweave-gateway-dev` profile with temporary credentials\
   `aws-vault exec arweave-gateway-dev`
