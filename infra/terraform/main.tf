data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

module "documentdb" {
  count  = var.provision_documentdb ? 1 : 0
  source = "./modules/documentdb"

  project_name            = var.project_name
  vpc_id                  = var.vpc_id
  subnet_ids              = var.subnet_ids
  allowed_cidr_blocks     = var.documentdb_allowed_cidrs
  master_username         = var.documentdb_master_username
  master_password         = var.documentdb_master_password
  db_name                 = var.documentdb_db_name
  engine_version          = var.documentdb_engine_version
  instance_class          = var.documentdb_instance_class
  instance_count          = var.documentdb_instance_count
  backup_retention_period = var.documentdb_backup_retention_period
  preferred_backup_window = var.documentdb_preferred_backup_window
  storage_encrypted       = var.documentdb_storage_encrypted
  deletion_protection     = var.documentdb_deletion_protection
  skip_final_snapshot     = var.documentdb_skip_final_snapshot
  apply_immediately       = var.documentdb_apply_immediately
}

locals {
  resolved_mongo_uri = var.provision_documentdb ? module.documentdb[0].connection_uri : var.mongo_uri
  final_ami_id       = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux.id

  base_env = {
    NODE_ENV                         = "production"
    MONGO_URI                        = local.resolved_mongo_uri
    INGESTION_SOURCES                = var.ingestion_sources
    EMAIL_SOURCE_KEY                 = var.email_source_key
    EMAIL_HOST                       = var.email_host
    EMAIL_PORT                       = tostring(var.email_port)
    EMAIL_SECURE                     = tostring(var.email_secure)
    EMAIL_USERNAME                   = var.email_username
    EMAIL_PASSWORD                   = var.email_password
    EMAIL_MAILBOX                    = var.email_mailbox
    EMAIL_FROM_FILTER                = var.email_from_filter
    OCR_PROVIDER                     = var.ocr_provider
    CONFIDENCE_EXPECTED_MAX_TOTAL    = tostring(var.confidence_expected_max_total)
    CONFIDENCE_EXPECTED_MAX_DUE_DAYS = tostring(var.confidence_expected_max_due_days)
    CONFIDENCE_AUTO_SELECT_MIN       = tostring(var.confidence_auto_select_min)
    TALLY_ENDPOINT                   = var.tally_endpoint
    TALLY_COMPANY                    = var.tally_company
    TALLY_PURCHASE_LEDGER            = var.tally_purchase_ledger
    DEFAULT_APPROVER                 = "worker"
  }

  final_env = merge(local.base_env, var.extra_env)
}

module "spot_worker" {
  source = "./modules/spot_worker"

  project_name             = var.project_name
  vpc_id                   = var.vpc_id
  subnet_ids               = var.subnet_ids
  instance_type            = var.instance_type
  ami_id                   = local.final_ami_id
  key_name                 = var.key_name
  app_image                = var.app_image
  env_map                  = local.final_env
  google_credentials_json  = var.google_credentials_json
  api_ingress_cidrs        = var.api_ingress_cidrs
  schedule_scale_up_cron   = var.schedule_scale_up_cron
  schedule_scale_down_cron = var.schedule_scale_down_cron
}
