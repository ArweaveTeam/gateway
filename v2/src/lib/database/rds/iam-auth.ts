import AWS from "aws-sdk";

interface RdsIamAuthTokenOptions {
  host: string;
  port: number;
  user: string;
}

export const useRdsIamAuth = (): boolean => !!process.env.PG_USE_RDS_IAM;

export const getRdsIamAuthToken = ({
  host,
  user,
  port,
}: RdsIamAuthTokenOptions): string => {
  return new AWS.RDS.Signer().getAuthToken({
    region: process.env.AWS_REGION,
    username: user,
    hostname: host,
    port: port,
  });
};
