# Avaliação Prática de DevOps — Cadastro de Produtos

## Apresentação

O projeto da Prova A implanta uma aplicação de cadastro e listagem de produtos em duas máquinas virtuais. O OpenTofu com libvirt/KVM provisiona as VMs Ubuntu Server 24.04, o cloud-init configura o acesso inicial e o Ansible instala Docker e Docker Compose v2 e implanta os serviços.

O frontend usa HTML, CSS e JavaScript nativos servidos pelo Nginx. A API REST usa Node.js e Express, e os produtos são armazenados no MySQL.

## Integrantes

- **Luiz André Oliveira Almeida** — [@luiz-almeida-dev](https://github.com/luiz-almeida-dev)
- **Pedro Henrique Barion** — [@PedroHBarion](https://github.com/PedroHBarion)
- **Ana Tereza Rodrigues Magalhães** — [@anamagalhaesss](https://github.com/anamagalhaesss)

## Arquitetura

| VM | Recursos | Serviços e portas |
| --- | --- | --- |
| VM1 — `prova-devops-web` | 1 vCPU, 1024 MiB, 8 GiB | Nginx na porta HTTP `80`, com o frontend. |
| VM2 — `prova-devops-api` | 1 vCPU, 2048 MiB, 8 GiB | API Node.js na porta HTTP `3000`. MySQL na porta `3306`, restrita à rede interna do Compose. |

O navegador carrega a interface na VM1 e chama diretamente a API na VM2 por HTTP. A API aceita via CORS a origem exata da página na VM1 e acessa o MySQL pelo nome do serviço Docker. O banco usa o volume nomeado `avaliacao-products_mysql-data`, preservado nos reinícios dos contêineres.

A rede libvirt `default` fornece os IPs por DHCP. Na execução validada, a VM1 recebeu `192.168.122.150` e a VM2 recebeu `192.168.122.121`. Esses IPs podem mudar. Consulte os outputs e as concessões atuais do libvirt antes de atualizar o inventário ou acessar a aplicação. O navegador precisa alcançar os dois IPs na rede do laboratório.

## Estrutura do projeto

| Diretório | Arquivos principais |
| --- | --- |
| [`app/`](app/) | `index.html`, `styles.css` e `products.js` compõem a interface. O `Dockerfile` cria a imagem Nginx. |
| [`api/`](api/) | `server.js` implementa as rotas. `package.json` e o lockfile definem as dependências. `Dockerfile`, `docker-compose.yml` e `init.sql` definem a API, o banco e a tabela inicial. `.env.example` e [`api/README.md`](api/README.md) documentam a configuração local. |
| [`iac/`](iac/) | `main.tf` define as VMs, os volumes, as ISOs e os outputs. `cloud_init.cfg` configura o acesso SSH. `.terraform.lock.hcl` registra a versão e os hashes do provedor. |
| [`ansible/`](ansible/) | `inventory` separa as VMs por função. `known_hosts` registra as identidades públicas SSH. `playbook.yml` instala e implanta os serviços, e `converge_compose.yml` controla a reconstrução das imagens. |

## Pré-requisitos

- Host Linux x86-64 com virtualização de hardware disponível, QEMU/KVM, libvirt e acesso autorizado a `qemu:///system`. A rede e o pool libvirt `default` devem estar ativos, com DHCP e espaço para a imagem base e os discos.
- OpenTofu 1.13.1, provedor `dmacvicar/libvirt` 0.8.3 e `mkisofs` para gerar as ISOs de cloud-init.
- Ansible Core 2.21.5 com Ansible Vault, cliente OpenSSH e o par de chaves em `~/.ssh/devops_lab` e `~/.ssh/devops_lab.pub`, conforme os padrões do inventário e do OpenTofu.
- OpenSSL para gerar os segredos em um ambiente novo e `curl` para as verificações HTTP.
- Conectividade para baixar o provedor e a imagem Ubuntu, instalar os pacotes nas VMs e obter as imagens e dependências dos contêineres. O playbook instala `docker.io` e `docker-compose-v2` nas VMs.

## Provisionamento

Execute na raiz do repositório. Revise o plano antes de confirmar o `apply` interativo. Em um ambiente novo, são esperadas sete criações, incluindo duas VMs, três volumes e duas ISOs, sem alterações ou destruições de recursos existentes.

```bash
tofu -chdir=iac init
tofu -chdir=iac fmt -check
tofu -chdir=iac validate
tofu -chdir=iac plan
tofu -chdir=iac apply
web_ip=$(tofu -chdir=iac output -raw web)
api_ip=$(tofu -chdir=iac output -raw api)
virsh -r -c qemu:///system net-dhcp-leases default
```

Para VMs recém-provisionadas, atualize os IPs em `ansible/inventory` e registre em `ansible/known_hosts` as chaves públicas de host correspondentes, após confirmar suas impressões digitais. O arquivo entregue contém as identidades aprovadas das VMs da avaliação. Com os IPs e as chaves conferidos, teste o acesso e a conclusão do cloud-init.

```bash
for ip in "$web_ip" "$api_ip"; do
  ssh -i ~/.ssh/devops_lab -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes \
    -o "UserKnownHostsFile=\"$PWD/ansible/known_hosts\"" \
    "aluno@$ip" 'hostnamectl --static && cloud-init status --wait && sudo -n true'
done
```

## Implantação

O inventário usa os grupos `web` e `api`, o usuário `aluno` e `become`. O playbook deriva o endereço da API e a origem CORS dos IPs do inventário. O frontend é implantado em `/opt/prova-devops`, assim como os arquivos da API e do Compose na VM2.

O Ansible Vault recebe `mysql_password` e `mysql_root_password`, duas senhas aleatórias distintas de 48 caracteres hexadecimais. Para um ambiente novo, o bloco abaixo gera os segredos e envia as variáveis ao Vault pela entrada padrão. Execute somente na primeira configuração. Reutilize o Vault existente em reexecuções com o mesmo volume MySQL.

```bash
(
  set -eu
  umask 077
  vault_dir="$HOME/.config/prova-devops-vault"
  mkdir -m 700 "$vault_dir"
  openssl rand -hex 32 > "$vault_dir/master.pass"
  {
    printf 'mysql_password: "%s"\n' "$(openssl rand -hex 24)"
    printf 'mysql_root_password: "%s"\n' "$(openssl rand -hex 24)"
  } | ansible-vault encrypt --vault-password-file "$vault_dir/master.pass" \
      --output "$vault_dir/mysql.vault.yml" -
)
```

Mantenha o Vault e o arquivo mestre fora do repositório, com permissões `0600`. O playbook gera na VM2 o `/opt/prova-devops/.env` com proprietário `root` e permissão `0600`.

```bash
vault_dir="$HOME/.config/prova-devops-vault"
ansible -i ansible/inventory all -m ping
ansible-playbook -i ansible/inventory ansible/playbook.yml --syntax-check
ansible-playbook -i ansible/inventory ansible/playbook.yml \
  --vault-password-file "$vault_dir/master.pass" \
  --extra-vars "@$vault_dir/mysql.vault.yml"
ansible -i ansible/inventory all -m ansible.builtin.command -a 'docker ps'
```

## Utilização

Abra o [frontend da avaliação](http://192.168.122.150/) em um navegador com acesso à rede do laboratório. Se o endereço tiver mudado, use o IP atual da VM web. Preencha nome, categoria, preço e quantidade em estoque e clique em **Cadastrar produto**. Use **Listar todos os produtos** para consultar os registros.

| Endpoint | Comportamento |
| --- | --- |
| `POST /produto` | Recebe JSON com `name`, `category`, `price` e `quantity`. Retorna HTTP `201` após gravar no MySQL, ou `400` para dados inválidos. |
| `GET /produtos` | Retorna HTTP `200` com o array JSON dos produtos cadastrados. |

```bash
curl -fsS "http://${web_ip}/" -o /dev/null -w '%{http_code}\n'
curl -fsS "http://${api_ip}:3000/produtos"
```

## Validações realizadas

- A página, o CSS, o JavaScript e a consulta à API responderam HTTP `200`. O cadastro pelo Firefox retornou HTTP `201` e o produto apareceu na listagem.
- O preflight retornou HTTP `204` com a origem permitida `http://192.168.122.150`. Uma origem alternativa ficou sem permissão CORS, e a operação pela interface ocorreu sem erros de CORS.
- Após reiniciar os três contêineres, o produto continuou visível no Firefox e o registro permaneceu idêntico na API e na consulta direta ao MySQL.
- A reexecução final do Ansible registrou `changed=0`, `failed=0` e `unreachable=0` nas duas VMs, preservando os contêineres, o volume, o registro e as credenciais.

## Decisões técnicas

A imagem padrão `mysql:8.4` falhou na VM da API porque exige instruções `x86-64-v2` que a CPU virtual não oferece. A implantação Ansible usa `mysql:8.4.0-oraclelinux8`, variante que foi testada nessa VM. É uma versão corretiva antiga da série 8.4, selecionada para compatibilidade no laboratório. Para uso em produção, a plataforma e a escolha de uma versão corrigida e compatível precisam ser reavaliadas.

## Referência

[Repositório oficial das aulas de DevOps](https://github.com/marcelo-ciacco/devops-2026)
