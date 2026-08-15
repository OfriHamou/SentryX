import { Request, Response } from "express";
import { QueryFailedError } from "typeorm";
import { AppDataSource } from "../db";
import { OrganizationController } from "./OrganizationController";

jest.mock("../db", () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe("OrganizationController.deleteOrganizationUser", () => {
    const findOne = jest.fn();
    const remove = jest.fn();

    const createResponse = () => {
        const json = jest.fn();
        const status = jest.fn(() => ({ json }));
        const response = {
            locals: {
                auth: {
                    userId: "current-user",
                    tenantId: "tenant-a",
                },
            },
            status,
        } as unknown as Response;

        return { response, status, json };
    };

    const createRequest = (id: string) => ({ params: { id } }) as unknown as Request;

    beforeEach(() => {
        jest.clearAllMocks();
        (AppDataSource.getRepository as jest.Mock).mockReturnValue({ findOne, remove });
    });

    it("returns 404 when the user is not in the authenticated tenant", async () => {
        findOne.mockResolvedValue(null);
        const { response, status, json } = createResponse();

        await OrganizationController.deleteOrganizationUser(createRequest("tenant-b-user"), response);

        expect(findOne).toHaveBeenCalledWith({
            where: { id: "tenant-b-user", tenant: { id: "tenant-a" } },
        });
        expect(remove).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ message: "User not found in this organization" });
    });

    it("rejects self-deletion", async () => {
        findOne.mockResolvedValue({ id: "current-user" });
        const { response, status, json } = createResponse();

        await OrganizationController.deleteOrganizationUser(createRequest("current-user"), response);

        expect(remove).not.toHaveBeenCalled();
        expect(status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith({ message: "You cannot delete your own user account" });
    });

    it("deletes another user in the authenticated tenant", async () => {
        const targetUser = { id: "tenant-a-user" };
        findOne.mockResolvedValue(targetUser);
        remove.mockResolvedValue(targetUser);
        const { response, status, json } = createResponse();

        await OrganizationController.deleteOrganizationUser(createRequest(targetUser.id), response);

        expect(remove).toHaveBeenCalledWith(targetUser);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({ message: "User deleted successfully" });
    });

    it("returns 409 when operational records restrict deletion", async () => {
        const targetUser = { id: "referenced-user" };
        findOne.mockResolvedValue(targetUser);
        remove.mockRejectedValue(new QueryFailedError(
            "DELETE FROM users WHERE id = $1",
            [targetUser.id],
            Object.assign(new Error("foreign key violation"), { code: "23503" }),
        ));
        const { response, status, json } = createResponse();

        await OrganizationController.deleteOrganizationUser(createRequest(targetUser.id), response);

        expect(status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith({
            message: "This user cannot be deleted because they are referenced by existing operational records.",
        });
    });
});
