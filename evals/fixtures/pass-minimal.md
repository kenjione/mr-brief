<!-- mr-brief v1 -->

Deactivated subscriptions no longer come back from the lookup the payments service uses.

### Key changes
- **The lookup asks only for active subscriptions** — a dead one resolves to nothing instead of being served
- **`blocked` is its own field** — a subscription can be paid up and blocked at once
- **The subscription says which plan it pays for** — no second call needed

### Where to look · ~5 min · skip the specs
- [ ] **Start →** [subscription_service.rb:49](https://gitlab.example.com/g/r/-/blob/abc123/app/models/subscription_service.rb#L49) — the one line that changes behaviour
- [ ] [subscription_serializer.rb:8](https://gitlab.example.com/g/r/-/blob/abc123/app/serializers/subscription_serializer.rb#L8) — `blocked` as a field
- [ ] [account_serializer.rb:59](https://gitlab.example.com/g/r/-/blob/abc123/app/serializers/account_serializer.rb#L59) — the same flag, other payload

### Risk
> a charge that used to find a dead subscription now finds none and is refused. Loudly.
>
> Rollback: revert. No migration.
