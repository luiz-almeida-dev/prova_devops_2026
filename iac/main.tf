terraform {
  required_providers {
    libvirt = {
      source  = "dmacvicar/libvirt"
      version = "0.8.3"
    }
  }
}

provider "libvirt" {
  uri = "qemu:///system"
}

variable "network_name" {
  type    = string
  default = "default"
}

variable "storage_pool" {
  type    = string
  default = "default"
}

variable "image_url" {
  type    = string
  default = "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/devops_lab.pub"
}

variable "ssh_user" {
  type    = string
  default = "aluno"
}

variable "vm_resources" {
  type = object({
    web = object({ vcpu = number, memory_mib = number, disk_gib = number })
    api = object({ vcpu = number, memory_mib = number, disk_gib = number })
  })

  default = {
    web = { vcpu = 1, memory_mib = 1024, disk_gib = 8 }
    api = { vcpu = 1, memory_mib = 2048, disk_gib = 8 }
  }
}

locals {
  vm_names = { for role in keys(var.vm_resources) : role => "prova-devops-${role}" }
}

resource "libvirt_volume" "ubuntu_base" {
  name   = "prova-devops-ubuntu-24.04-base.qcow2"
  pool   = var.storage_pool
  source = var.image_url
  format = "qcow2"
}

resource "libvirt_volume" "vm_disk" {
  for_each = local.vm_names

  name           = "${each.value}.qcow2"
  pool           = var.storage_pool
  base_volume_id = libvirt_volume.ubuntu_base.id
  format         = "qcow2"
  size           = var.vm_resources[each.key].disk_gib * 1024 * 1024 * 1024
}

resource "libvirt_cloudinit_disk" "vm_init" {
  for_each = local.vm_names

  name = "${each.value}-cloudinit.iso"
  pool = var.storage_pool

  user_data = templatefile("${path.module}/cloud_init.cfg", {
    hostname = each.value
    ssh_user = var.ssh_user
    ssh_key  = trimspace(file(pathexpand(var.ssh_public_key_path)))
  })
}

resource "libvirt_domain" "vm" {
  for_each = local.vm_names

  name      = each.value
  vcpu      = var.vm_resources[each.key].vcpu
  memory    = var.vm_resources[each.key].memory_mib
  cloudinit = libvirt_cloudinit_disk.vm_init[each.key].id

  network_interface {
    network_name   = var.network_name
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.vm_disk[each.key].id
  }

  console {
    type        = "pty"
    target_type = "serial"
    target_port = "0"
  }
}

output "web" {
  description = "DHCP IP address of the web VM."
  value       = libvirt_domain.vm["web"].network_interface[0].addresses[0]
}

output "api" {
  description = "DHCP IP address of the API VM."
  value       = libvirt_domain.vm["api"].network_interface[0].addresses[0]
}
