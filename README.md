# Avaliação Prática de DevOps — Cadastro de Produtos

## Apresentação

A avaliação tem como objetivo implementar uma aplicação distribuída de cadastro de produtos em duas máquinas virtuais, usando infraestrutura como código, automação e contêineres.

## Tecnologias

- OpenTofu
- cloud-init
- Ansible
- Docker
- Node.js
- MySQL
- HTML, CSS e JavaScript
- API REST

## Arquitetura

A arquitetura a seguir será implementada nas próximas etapas da avaliação.

- **VM1** hospedará a aplicação web em um contêiner Docker.
- **VM2** hospedará a API REST em Node.js e o banco de dados MySQL em contêineres Docker.
- A aplicação web acessará a API REST por HTTP.
- O OpenTofu provisionará as VMs, o cloud-init fará a preparação inicial e o Ansible automatizará a implantação.

## Estrutura do projeto

- `ansible/` reúne o inventário e o playbook de implantação.
- `iac/` reúne a configuração de provisionamento com OpenTofu e a configuração inicial com cloud-init em `iac/cloud_init.yaml`.
- `app/` reúne a configuração da imagem Docker da aplicação web.
- `api/` reúne a configuração da imagem Docker da API e do Docker Compose para a API e o MySQL.

## Execução

Seção reservada para as instruções de provisionamento, implantação e acesso à aplicação.

## Integrantes

- **Luiz André Oliveira Almeida** — [@luiz-almeida-dev](https://github.com/luiz-almeida-dev)
- **Pedro Henrique Barion** — [@PedroHBarion](https://github.com/PedroHBarion)
- **Ana Tereza Rodrigues Magalhães** — [@anatereza](https://github.com/anatereza)

## Referência

[Repositório oficial das aulas de DevOps](https://github.com/marcelo-ciacco/devops-2026)
