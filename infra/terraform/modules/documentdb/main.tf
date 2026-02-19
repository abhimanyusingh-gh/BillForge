locals {
  cluster_identifier = "${var.project_name}-docdb"
  tags = {
    Project = var.project_name
  }
}

resource "aws_security_group" "documentdb" {
  name        = "${var.project_name}-docdb-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = toset(var.allowed_cidr_blocks)
    content {
      from_port   = 27017
      to_port     = 27017
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_docdb_subnet_group" "documentdb" {
  name        = "${var.project_name}-docdb-subnets"
  description = "Subnet group for ${var.project_name} DocumentDB"
  subnet_ids  = var.subnet_ids

  tags = local.tags
}

resource "aws_docdb_cluster" "documentdb" {
  cluster_identifier      = local.cluster_identifier
  engine                  = "docdb"
  engine_version          = var.engine_version
  master_username         = var.master_username
  master_password         = var.master_password
  db_subnet_group_name    = aws_docdb_subnet_group.documentdb.name
  vpc_security_group_ids  = [aws_security_group.documentdb.id]
  backup_retention_period = var.backup_retention_period
  preferred_backup_window = var.preferred_backup_window
  storage_encrypted       = var.storage_encrypted
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  apply_immediately       = var.apply_immediately

  tags = local.tags
}

resource "aws_docdb_cluster_instance" "documentdb" {
  count = var.instance_count

  identifier         = "${var.project_name}-docdb-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.documentdb.id
  instance_class     = var.instance_class
  apply_immediately  = var.apply_immediately

  tags = local.tags
}
