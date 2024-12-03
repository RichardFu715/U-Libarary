import {Elysia, error, t} from "elysia";
import {checkJWT} from "../Runtime/Auth";
import {User} from "../Runtime/User";
import {UserRole} from "../../../common/User";

export const userGroup = new Elysia()
    .decorate('user', new User())
    .group('/user', (app) => app
        .get('whoami', ({ user, cookie: { permission } }) => user.whoami( permission.toString() ))
        .post('add', ({ user, body: { data }, error }) => {
            try {
                user.add(data);
            } catch (e) {
                return error(406, e);
            }
        }, {
            body: t.Object({
                data: t.Object({
                    username: t.String(),
                    email: t.String(),
                    password: t.String(),
                })
            })
        })
        // Guard of Admin Actions
        .guard(
            {
                async beforeHandle ({cookie: { permission }}) {
                    if (permission === undefined) {
                        return error(401, "Unauthorized");
                    }
                    return await checkJWT(permission.value || "", "Admin", error)
                }
            }, (app) => app
                .get('', ({ user }) => user.get())
                .post('update', ({ user, body: { data }, error }) => {
                    try {
                        user.update(data);
                    } catch (e) {
                        return error(406, e);
                    }
                }, {
                    body: t.Object({
                        data: t.Object({
                            id: t.String(),
                            username: t.String(),
                            email: t.String(),
                            password: t.String(),
                            role: t.Enum(UserRole),
                        })
                    })
                })
                .delete('delete/:id', ({ user, params: { id }, error }) => {
                    try {
                        user.delete(decodeURI(id));
                    } catch (e) {
                        return error(406, e);
                    }
                }, {
                    params: t.Object({
                        id: t.String()
                    })
                })
        )
    );