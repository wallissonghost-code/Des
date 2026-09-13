# DES · Roblox Avatar 3D

Protótipo web para carregar o avatar 3D atual de um usuário Roblox, incluindo corpo, roupas, skin e acessórios presentes no modelo retornado pelo serviço de thumbnails 3D do Roblox.

## Como rodar

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Fluxo

1. Resolve o username em `users.roblox.com`.
2. Solicita o avatar em `thumbnails.roblox.com/v1/users/avatar-3d`.
3. Lê o descritor OBJ/MTL/texturas retornado pelo CDN do Roblox.
4. Faz proxy dos assets pelo servidor para evitar problemas de CORS.
5. Renderiza o boneco no navegador usando Three.js.

## Autenticação do Roblox

O endpoint `avatar-3d` é Beta e a documentação atual do Roblox indica suporte a API Key/OAuth/Cookie. O projeto tenta primeiro a rota atual e mantém uma rota de compatibilidade. Em ambientes que exigirem autenticação, defina a variável de ambiente:

```bash
ROBLOX_API_KEY=sua_chave
```

Nunca coloque a chave no JavaScript do navegador ou no repositório.

## Observação importante

O modelo 3D retornado por esse endpoint é um snapshot renderizável do avatar. Ele é adequado para exibir o personagem real em HUDs, perfis, rankings e sistemas web. Não deve ser tratado como substituto de um rig Roblox completo pronto para animações arbitrárias fora da plataforma.
