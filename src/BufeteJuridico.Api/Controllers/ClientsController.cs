using BufeteJuridico.Application.Administration;
using BufeteJuridico.Application.Authorization;
using BufeteJuridico.Application.Clients;
using BufeteJuridico.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BufeteJuridico.Api.Controllers;

[Authorize]
public sealed class ClientsController(IClientService service, IDeletedRecordService deletedRecords) : ApiV1ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.ClientsRead)]
    public async Task<ActionResult<PagedResult<ClientDto>>> GetAll(
        string? search, int page = 1, int pageSize = 25, CancellationToken cancellationToken = default, bool? isActive = true) =>
        Ok(await service.GetClientsAsync(search, page, pageSize, cancellationToken, isActive));

    [HttpPut("{id:guid}/attention")]
    [Authorize(Policy = Permissions.ClientsWrite)]
    public async Task<ActionResult<ClientDto>> SetAttention(Guid id, SetClientAttentionRequest request, CancellationToken cancellationToken) =>
        Ok(await service.SetAttentionAsync(id, request, cancellationToken));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.ClientsRead)]
    public async Task<ActionResult<ClientDto>> Get(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetClientAsync(id, cancellationToken));

    [HttpGet("{id:guid}/profile")]
    [Authorize(Policy = Permissions.ClientsRead)]
    public async Task<ActionResult<ClientProfileDto>> GetProfile(Guid id, CancellationToken cancellationToken) =>
        Ok(await service.GetClientProfileAsync(id, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Permissions.ClientsWrite)]
    public async Task<ActionResult<ClientDto>> Create(SaveClientRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateClientAsync(request, cancellationToken);
        return Created($"/api/v1/clients/{result.Id}", result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.ClientsWrite)]
    public async Task<ActionResult<ClientDto>> Update(Guid id, SaveClientRequest request, CancellationToken cancellationToken) =>
        Ok(await service.UpdateClientAsync(id, request, cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.RecordsDelete)]
    public async Task<IActionResult> Delete(Guid id, DeleteRecordRequest request, CancellationToken cancellationToken)
    {
        await deletedRecords.DeleteAsync(DeletedRecordType.Client, id, request.Reason, cancellationToken);
        return NoContent();
    }

    [HttpGet("{clientId:guid}/income-declarations")]
    [Authorize(Policy = Permissions.ClientsRead)]
    public async Task<ActionResult<IReadOnlyList<IncomeDeclarationDto>>> GetDeclarations(Guid clientId, CancellationToken cancellationToken) =>
        Ok(await service.GetIncomeDeclarationsAsync(clientId, cancellationToken));

    [HttpPost("{clientId:guid}/income-declarations")]
    [Authorize(Policy = Permissions.ClientsWrite)]
    public async Task<ActionResult<IncomeDeclarationDto>> CreateDeclaration(Guid clientId, SaveIncomeDeclarationRequest request, CancellationToken cancellationToken)
    {
        var result = await service.CreateIncomeDeclarationAsync(clientId, request, cancellationToken);
        return Created($"/api/v1/clients/{clientId}/income-declarations/{result.Id}", result);
    }

    [HttpGet("income-declarations/{declarationId:guid}/print")]
    [Authorize(Policy = Permissions.ClientsRead)]
    [Produces("text/html")]
    public async Task<ContentResult> PrintDeclaration(Guid declarationId, CancellationToken cancellationToken) =>
        Content(await service.GenerateIncomeDeclarationHtmlAsync(declarationId, cancellationToken), "text/html", System.Text.Encoding.UTF8);
}
