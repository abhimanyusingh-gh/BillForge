resource "aws_iam_role" "worker" {
  name = "${var.project_name}-worker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "worker" {
  name = "${var.project_name}-worker-profile"
  role = aws_iam_role.worker.name
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_security_group" "worker" {
  name        = "${var.project_name}-worker-sg"
  description = "Security group for invoice worker"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.api_ingress_cidrs
    content {
      from_port   = 4000
      to_port     = 4000
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }
}

resource "aws_launch_template" "worker" {
  name_prefix   = "${var.project_name}-worker-"
  image_id      = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_name != "" ? var.key_name : null

  iam_instance_profile {
    name = aws_iam_instance_profile.worker.name
  }

  vpc_security_group_ids = [aws_security_group.worker.id]

  instance_market_options {
    market_type = "spot"

    spot_options {
      instance_interruption_behavior = "terminate"
      spot_instance_type             = "one-time"
    }
  }

  user_data = base64encode(
    templatefile("${path.module}/user_data.sh.tmpl", {
      app_image               = var.app_image
      env_map                 = var.env_map
      google_credentials_json = var.google_credentials_json
    })
  )

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name    = "${var.project_name}-worker"
      Project = var.project_name
    }
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_autoscaling_group" "worker" {
  name                = "${var.project_name}-worker-asg"
  max_size            = 1
  min_size            = 0
  desired_capacity    = 0
  vpc_zone_identifier = var.subnet_ids

  launch_template {
    id      = aws_launch_template.worker.id
    version = "$Latest"
  }

  health_check_type = "EC2"

  tag {
    key                 = "Name"
    value               = "${var.project_name}-worker"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }
}

resource "aws_autoscaling_schedule" "daily_up" {
  scheduled_action_name  = "${var.project_name}-scale-up"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  recurrence             = var.schedule_scale_up_cron
  min_size               = 1
  max_size               = 1
  desired_capacity       = 1
}

resource "aws_autoscaling_schedule" "daily_down" {
  scheduled_action_name  = "${var.project_name}-scale-down"
  autoscaling_group_name = aws_autoscaling_group.worker.name
  recurrence             = var.schedule_scale_down_cron
  min_size               = 0
  max_size               = 1
  desired_capacity       = 0
}
