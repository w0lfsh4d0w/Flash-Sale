module.exports = `
local eventKey = KEYS[1]
local requested = tonumber(ARGV[1])

if redis.call('EXISTS', eventKey) == 0 then
  return {-1, 0}
end

local available = tonumber(redis.call('HGET', eventKey, 'availableTickets'))

if available < requested then
  return {0, 0}
end

redis.call('HINCRBY', eventKey, 'availableTickets', -requested)
local price = tonumber(redis.call('HGET', eventKey, 'priceCents'))
return {1, price}
`;