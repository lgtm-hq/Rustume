# Neon module

Provision a Neon PostgreSQL project with a primary branch, application role, and database.

Provider: [`terraform-community-providers/neon`](https://registry.terraform.io/providers/terraform-community-providers/neon/latest/docs) (Neon API token via `NEON_TOKEN` or provider `token`).

## Usage

```hcl
module "neon" {
  source = "../modules/neon"

  project_name = "rustume-cloud-production"
  region_id    = "aws-us-west-2"
  branch_name  = "main"
  database_name = "rustume"
  role_name    = "rustume_app"
}
```

## Outputs

`database_url` and `role_password` are marked sensitive. Pass `database_url` to the Railway module as `DATABASE_URL` at apply time — never commit the value.

## Import

Import existing Neon resources per provider docs before first `terraform apply` against live infrastructure ([#333](https://github.com/lgtm-hq/Rustume/issues/333)).
