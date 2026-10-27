-- Presentation only. C++ supplies queue facts and validates all outgoing actions.
local function el(id) return document:GetElementById(id) end
local function escape(value)
    return (tostring(value or ''):gsub('&', '&amp;'):gsub('<', '&lt;'):gsub('>', '&gt;')
        :gsub('"', '&quot;'):gsub("'", '&#39;'))
end
local function set_markup(id, value)
    local node = el(id)
    if node.inner_rml ~= value then node.inner_rml = value end
end
local art = {
    LGAM001 = 'crystaldefenders',
    LGAM008 = 'caveofulverick',
    LGAM013 = 'hallsofoblivion',
    LGAM018 = 'seaofdawn',
    LGAM023 = 'draconispeaks',
    LGAM030 = 'akramarena',
    LGAM037 = 'sikukucatacombs',
}
local function image(item)
    local screenshot = art[item.art_key]
    if screenshot then return '/data/ui/themes/rose/imgs/arenas/' .. screenshot .. '.dds' end
    return '/3ddata/control/loading/general1.dds'
end
local catalog, incoming, families, visible = {}, {}, {}, {}
local selected, filter, query, only_level = nil, 0, '', false
local level, can_queue, members, limit = 1, false, 0, 15
local last_catalog, last_list, last_detail = '', '', ''
local function eligible(item) return level >= item.minimum and level <= item.maximum end
local function name(item) return item.name:gsub('%s*%(%d+%s*%-%s*%d+%)%s*$', '') end
local function render_detail()
    local family = families[selected]
    if not family then
        set_markup('arena-detail-content', '<div class="arena-empty ui-status">No arenas match your filters.</div>')
        last_detail = ''
        return
    end
    local item = family.versions[1]
    local rows = {}
    for _, version in ipairs(family.versions) do
        local ok = eligible(version)
        local enabled = can_queue and not version.locked and (ok or version.queued)
        local label = version.queued and 'Leave Queue' or enabled and 'Join Queue' or 'Locked'
        local reason = version.queued and 'Queued' or not ok and (level < version.minimum and 'Too low' or 'Too high')
            or version.locked and 'Unavailable' or not can_queue and 'Group / game restricted' or ''
        local fee = version.fee ~= '' and '<div class="ui-currency"><img sprite="currencyicon-' .. version.currency .. '" /><span>' .. escape(version.fee) .. '</span></div>' or ''
        rows[#rows + 1] = '<div class="arena-version"><div class="arena-version-range"><b>' .. version.minimum .. ' - ' .. version.maximum ..
            '</b>' .. (reason ~= '' and '<span class="arena-caption">' .. reason .. '</span>' or '') .. fee .. '</div><div class="arena-version-count">' ..
            (version.players >= 0 and version.players or '—') .. '</div><div class="arena-version-wait">—</div><div class="arena-version-action"><button class="default ui-compact" id="arena-queue-' .. version.id ..
            '" onclick="join:' .. version.id .. '"' .. (enabled and '' or ' disabled="disabled"') .. '>' .. label .. '</button></div></div>'
    end
    local html = '<div class="arena-hero" style="decorator: image(' .. image(item) .. ' cover);"><div class="arena-hero-caption"><span class="arena-caption">' ..
        (item.kind == 1 and 'Dungeon' or 'PvP Arena') .. '</span><div class="ui-section-title">' .. escape(name(item)) .. '</div></div></div>' ..
        '<div class="arena-stats"><span>Players: <b>' .. item.players_min .. ' - ' .. item.players_max ..
        (item.kind == 2 and ' per team' or '') .. '</b></span><span>Pre-Groups: <b>' .. (item.pregroups and 'Allowed' or 'Not allowed') .. '</b></span></div>' ..
        '<div class="arena-version-heading"><span class="ui-section-title">Level brackets</span><span class="arena-caption">Your level: ' .. level .. '</span></div>' ..
        '<div class="arena-versions"><div class="arena-version arena-caption"><span class="arena-version-range">Level range</span><span class="arena-version-count">In queue</span><span class="arena-version-wait">Wait</span><span class="arena-version-action" /></div>' ..
        table.concat(rows) .. '</div><div class="arena-description">' .. item.description ..
        '</div>'
    if html ~= last_detail then
        el('arena-detail-content').inner_rml = html
        last_detail = html
    end
end
local function render()
    local groups = {{label = 'Dungeons', kind = 1, rows = {}}, {label = 'PvP Arenas', kind = 2, rows = {}}}
    visible = {}
    for _, family in pairs(families) do
        local item, ok = family.versions[1], false
        for _, version in ipairs(family.versions) do ok = ok or eligible(version) end
        if (filter == 0 or item.kind == filter) and (not only_level or ok) and name(item):lower():find(query, 1, true) then
            visible[#visible + 1] = family
        end
    end
    table.sort(visible, function(a, b)
        if a.versions[1].kind ~= b.versions[1].kind then return a.versions[1].kind < b.versions[1].kind end
        return a.id < b.id
    end)
    local found = false
    for _, family in ipairs(visible) do found = found or family.id == selected end
    if not found then selected = visible[1] and visible[1].id or nil end
    for _, family in ipairs(visible) do
        local item, lo, hi, ok = family.versions[1], math.huge, 0, false
        for _, version in ipairs(family.versions) do
            lo, hi, ok = math.min(lo, version.minimum), math.max(hi, version.maximum), ok or eligible(version)
        end
        local row = '<div id="arena-game-' .. family.id .. '" class="ui-list-row arena-card' .. (selected == family.id and ' selected' or '') .. '" arena-family="' .. family.id ..
            '" style="decorator: image(' .. image(item) .. ' cover);"><div class="arena-card-overlay"><div class="arena-card-copy"><span class="arena-card-name">' .. escape(name(item)) ..
            '</span><span class="arena-caption">Lv ' .. lo .. ' - ' .. hi .. '</span></div><span class="arena-dot' .. (ok and ' eligible' or '') .. '" /></div></div>'
        local group = groups[item.kind == 1 and 1 or 2]
        group.rows[#group.rows + 1] = row
    end
    local parts = {}
    for _, group in ipairs(groups) do
        if #group.rows > 0 then
            parts[#parts + 1] = '<div class="arena-heading"><span class="ui-section-title">' .. group.label .. '</span><span class="arena-caption">' .. #group.rows .. '</span></div>' .. table.concat(group.rows)
        end
    end
    local html = #parts > 0 and table.concat(parts) or '<div class="arena-empty ui-status">No arenas match your filters.</div>'
    if html ~= last_list then el('arena-game-list').inner_rml = html; last_list = html end
    render_detail()
end

document:AddEventListener('arena-catalog-begin', function() incoming = {} end)
document:AddEventListener('arena-catalog-item', function(event)
    local p = event.parameters
    incoming[#incoming + 1] = {id = p.id, family = p.family, name = p.name, kind = p.kind, art_key = p.art_key,
        minimum = p.minimum, maximum = p.maximum, players_min = p.players_min, players_max = p.players_max,
        pregroups = p.pregroups, description = p.description, queued = p.queued, locked = p.locked,
        players = p.players, fee = p.fee or '', currency = p.currency or 0}
end)
document:AddEventListener('arena-catalog-end', function(event)
    local p = event.parameters
    level, can_queue, members, limit = p.level, p.can_queue, p.members, p.limit
    set_markup('arena-group-summary', members > 0 and 'Group: ' .. members .. ' / ' .. limit .. ' members' or 'No group')
    local signature = {tostring(level), tostring(can_queue)}
    for _, item in ipairs(incoming) do
        for _, key in ipairs({'id','family','name','kind','art_key','minimum','maximum','players_min','players_max','pregroups','description','queued','locked','players','fee','currency'}) do
            signature[#signature + 1] = tostring(item[key])
        end
    end
    local key = table.concat(signature, '\31')
    if key == last_catalog then return end
    last_catalog, catalog, families = key, incoming, {}
    for _, item in ipairs(catalog) do
        local family = families[item.family] or {id = item.family, versions = {}}
        family.versions[#family.versions + 1] = item
        families[item.family] = family
    end
    for _, family in pairs(families) do table.sort(family.versions, function(a, b) return a.minimum < b.minimum end) end
    render()
end)
el('arena-search'):AddEventListener('change', function(event)
    query = (event.parameters.value or ''):match('^%s*(.-)%s*$'):lower()
    render()
end)
local function filter_level(enabled)
    only_level = enabled
    el('arena-all-levels'):SetClass('selected', not enabled)
    el('arena-level-filter'):SetClass('selected', enabled)
    render()
end
el('arena-all-levels'):AddEventListener('click', function() filter_level(false) end)
el('arena-level-filter'):AddEventListener('click', function() filter_level(true) end)
document:AddEventListener('click', function(event)
    local target = event.target_element
    while target and target ~= document do
        local category, family = tonumber(target:GetAttribute('arena-filter')), tonumber(target:GetAttribute('arena-family'))
        if category then
            filter = category
            for index, id in ipairs({'arena-all', 'arena-dungeons', 'arena-pvp'}) do el(id):SetClass('selected', filter == index - 1) end
            render()
            return
        end
        if family then selected = family; render(); return end
        target = target.parent_node
    end
end)
