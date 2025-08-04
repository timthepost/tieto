# Contributing To Tieto

All ideas and contributions are welcome, provided that you abide by the
[code of conduct][1]. You can use the facilities at Github, or email me directly
at `timthepost@protonmail.com`.

Please have a look at the [main README][2], there's a list of things I'm
planning in roughly the order of how I'm currently prioritizing them.

I appreciate other contributions, but I'm likely going to politely say "_not
yet_" to things that change the core code in a way that isn't closer to one of
those listed goals.

## Things to keep in mind:

- Simplicity is the goal, overhead is bad.
- Let Unix be Unix.

## Things that are helpful to know:

- Limits of file systems (in general) and how btrfs works specifically.
- A basic working knowledge of Git (commit, clone, checkout, branch, merge)
- A basic knowledge of TypeScript (and Deno, with its tools, in particular)
- A basic knowledge of local (GGUF) models is very helpful.

If you have a basic grasp of these things, then you'll have no problem coming up
with ideal scenarios to use Tieto, or ideas for how it can be made even more
useful.

Please understand that our default use case is not being suggestive of any, or
balanced toward, any particular use case. Things that go into the core should
potentially help _everyone_; I can set up a `contrib/` area for tools that help
it excel in more specialized deployments.

Please use `deno fmt` prior to sending a PR, but I generally don't reject
otherwise great contributions because of simple things I can easily fix myself.
If it's useful and you can get it over the fence, send it and I'll take a look.

## Regarding turning Tieto into a proper class:

This generally happens _later_ in my development cycle, and tests usually come
as part of that. Right now it's being prototyped. But, the minute _needing_
things to be more organized actually holds up progress, it can happen. So please
don't do it _just to do it_, or it's likely going to get re-written anyway. But
if you're doing it to implement something else (like the CLI or splinter
integration) then it can happen without ceremony rather quickly.

[1]: https://www.contributor-covenant.org/version/3/0/code_of_conduct/
[2]: ../README.md
