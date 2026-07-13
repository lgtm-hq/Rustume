variable "zone_id" {
  description = "Cloudflare zone identifier for rustume.com."
  type        = string
}

variable "apex_domain" {
  description = "Apex domain name."
  type        = string
  default     = "rustume.com"
}

variable "app_subdomain" {
  description = "Rustume Cloud application subdomain label."
  type        = string
  default     = "app"
}

variable "pages_ipv4_addresses" {
  description = "GitHub Pages apex A record targets."
  type        = list(string)
  default = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ]
}

variable "pages_ipv6_addresses" {
  description = "GitHub Pages apex AAAA record targets."
  type        = list(string)
  default = [
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
  ]
}

variable "railway_cname_target" {
  description = "Railway custom-domain CNAME target for app.rustume.com."
  type        = string
}

variable "proxied" {
  description = "Whether Cloudflare should proxy the records (orange cloud)."
  type        = bool
  default     = true
}

variable "ttl" {
  description = "DNS TTL in seconds (1 = automatic when proxied)."
  type        = number
  default     = 1
}
